/* ============================================================
   Sy Trades — Giveaway entry proxy + winner draw (Cloudflare Worker)
   ------------------------------------------------------------
   POST /               — receives a giveaway entry from the website,
                          tags it with the active giveaway, logs it to
                          KV, and forwards it to Discord.
   GET  /admin          — admin page (giveaways, draws, entry management).
   GET  /admin/stats    — active giveaway + pool stats (admin key).
   POST /admin/giveaway — { name } start a new named giveaway (admin key).
   GET  /admin/entries  — all entries grouped by giveaway (admin key).
   POST /admin/delete   — { keys:[...] } delete entries (admin key).
   POST /admin/restore  — { keys:[...] } move entries into the active
                          giveaway's pool (admin key).
   POST /admin/draw     — draws N winners from the active giveaway's
                          eligible entries, posts to the winners channel,
                          and marks them as won (admin key).

   KV layout:
     meta:current   — { name, startedAt } active giveaway
     entry:<ts>:<r> — one entry: { ts, giveaway, won?, ...fields }
     draw:<ts>      — record of a draw

   Bindings (set in the Cloudflare dashboard):
     ENTRIES                 (KV namespace) — entry log + state
   Environment variables:
     DISCORD_WEBHOOK_URL     (Secret) — full-details entries channel webhook
     DISCORD_WEBHOOK_PUBLIC  (Secret, optional) — public feed channel webhook
     DISCORD_WEBHOOK_WINNERS (Secret) — winners channel webhook
     ADMIN_KEY               (Secret) — key required to use /admin
     ALLOWED_ORIGIN          (Text)   — site origin
   ============================================================ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin") return adminPage();
    if (url.pathname === "/admin/stats") return adminStats(request, env);
    if (url.pathname === "/admin/giveaway") return adminGiveaway(request, env);
    if (url.pathname === "/admin/entries") return adminEntries(request, env);
    if (url.pathname === "/admin/delete") return adminDelete(request, env);
    if (url.pathname === "/admin/restore") return adminRestore(request, env);
    if (url.pathname === "/admin/draw") return adminDraw(request, env);
    return handleEntry(request, env);
  }
};

/* ---------------- Entry intake ---------------- */

async function handleEntry(request, env) {
  const origin = env.ALLOWED_ORIGIN || "*";

  const cors = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }
  if (!env.DISCORD_WEBHOOK_URL) {
    return json({ error: "Server not configured" }, 500, cors);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, cors);
  }

  const clean = (v, max) => String(v == null ? "" : v).slice(0, max).trim();
  const firmName = clean(data.firmName, 80);
  const accountSize = clean(data.accountSize, 20);
  const orderId = clean(data.orderId, 120);
  const fullName = clean(data.fullName, 120);
  const code = clean(data.code, 40) || "OZZ";
  const discordUsername = clean(data.discordUsername, 80);
  const discordId = clean(data.discordId, 40);

  if (!firmName || !orderId || !fullName) {
    return json({ error: "Missing required fields" }, 400, cors);
  }

  // Which giveaway does this entry belong to?
  let giveawayName = "Unassigned";
  if (env.ENTRIES) {
    const cur = await getCurrent(env);
    if (cur && cur.name) giveawayName = cur.name;
  }

  const payload = {
    username: "Sy Trades Giveaway",
    embeds: [{
      title: "🎉 New Giveaway Entry",
      color: 0x2563eb,
      fields: [
        { name: "Firm", value: firmName, inline: true },
        { name: "Account Size", value: accountSize || "—", inline: true },
        { name: "Discount Code", value: code, inline: true },
        { name: "Order Number", value: "`" + orderId + "`", inline: false },
        { name: "Full Name (on order)", value: fullName, inline: true },
        { name: "Discord", value: discordUsername
            ? `${discordUsername} (\`${discordId}\`)` : "—", inline: true },
        { name: "Giveaway", value: giveawayName, inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      return json({ error: "Discord rejected", status: res.status }, 502, cors);
    }
  } catch {
    return json({ error: "Upstream failure" }, 502, cors);
  }

  // Log the entry to KV (the draw pool). Best-effort.
  if (env.ENTRIES) {
    try {
      const ts = new Date().toISOString();
      const key = `entry:${ts}:${crypto.randomUUID().slice(0, 8)}`;
      await env.ENTRIES.put(key, JSON.stringify({
        ts, giveaway: giveawayName,
        firmName, accountSize, orderId, fullName, code,
        discordUsername, discordId
      }));
    } catch { /* best-effort */ }
  }

  // Best-effort public feed: Discord name + account size only.
  if (env.DISCORD_WEBHOOK_PUBLIC) {
    const publicPayload = {
      username: "Sy Trades Giveaway",
      embeds: [{
        title: "🎟️ New Entry",
        color: 0x2563eb,
        fields: [
          { name: "Discord", value: discordUsername || "—", inline: true },
          { name: "Account Size", value: accountSize || "—", inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };
    try {
      await fetch(env.DISCORD_WEBHOOK_PUBLIC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(publicPayload)
      });
    } catch { /* best-effort */ }
  }

  return json({ ok: true }, 200, cors);
}

/* ---------------- Admin: shared ---------------- */

function authed(request, env) {
  const key = request.headers.get("x-admin-key") || "";
  return Boolean(env.ADMIN_KEY) && key === env.ADMIN_KEY;
}

async function getCurrent(env) {
  const raw = await env.ENTRIES.get("meta:current");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function listAll(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.ENTRIES.list({ prefix: "entry:", cursor });
    for (const k of page.keys) keys.push(k.name);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  const entries = [];
  for (const name of keys) {
    const raw = await env.ENTRIES.get(name);
    if (!raw) continue;
    try { entries.push({ key: name, ...JSON.parse(raw) }); } catch {}
  }
  return entries;
}

function eligible(e, currentName) {
  return Boolean(currentName) && (e.giveaway || "Unassigned") === currentName && !e.won;
}

/* ---------------- Admin: stats ---------------- */

async function adminStats(request, env) {
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  const current = await getCurrent(env);
  const all = await listAll(env);
  const pool = current ? all.filter(e => eligible(e, current.name)) : [];
  const people = new Set(pool.map(e => e.discordId || e.discordUsername || e.key));
  return json({
    giveaway: current,
    entriesInPool: pool.length,
    uniquePeople: people.size,
    totalEntries: all.length
  }, 200, {});
}

/* ---------------- Admin: start a new giveaway ---------------- */

async function adminGiveaway(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, {});
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  let body = {};
  try { body = await request.json(); } catch {}
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return json({ error: "Giveaway name required" }, 400, {});
  const current = { name, startedAt: new Date().toISOString() };
  await env.ENTRIES.put("meta:current", JSON.stringify(current));
  return json({ ok: true, giveaway: current }, 200, {});
}

/* ---------------- Admin: list / delete / restore entries ---------------- */

async function adminEntries(request, env) {
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  const current = await getCurrent(env);
  const currentName = current ? current.name : null;
  const all = await listAll(env);

  const entries = all.map(e => ({
    key: e.key,
    ts: e.ts,
    giveaway: e.giveaway || "Unassigned",
    won: e.won || null,
    firmName: e.firmName, accountSize: e.accountSize,
    orderId: e.orderId, fullName: e.fullName,
    discordUsername: e.discordUsername, discordId: e.discordId,
    restoredFrom: e.restoredFrom || null,
    inPool: eligible(e, currentName)
  }));
  entries.sort((a, b) => (a.key < b.key ? 1 : -1)); // newest first
  return json({ current: currentName, entries }, 200, {});
}

function validKeys(body) {
  const keys = Array.isArray(body.keys) ? body.keys : [];
  return keys.filter(k => typeof k === "string" && k.startsWith("entry:")).slice(0, 500);
}

async function adminDelete(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, {});
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  let body = {};
  try { body = await request.json(); } catch {}
  const keys = validKeys(body);
  if (keys.length === 0) return json({ error: "No valid entry keys" }, 400, {});
  for (const k of keys) await env.ENTRIES.delete(k);
  return json({ ok: true, deleted: keys.length }, 200, {});
}

async function adminRestore(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, {});
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  const current = await getCurrent(env);
  if (!current) return json({ error: "No active giveaway — start one first" }, 400, {});
  let body = {};
  try { body = await request.json(); } catch {}
  const keys = validKeys(body);
  if (keys.length === 0) return json({ error: "No valid entry keys" }, 400, {});

  let restored = 0;
  for (const k of keys) {
    const raw = await env.ENTRIES.get(k);
    if (!raw) continue;
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    data.restoredFrom = data.restoredFrom || data.giveaway || "Unassigned";
    data.giveaway = current.name;
    delete data.won;
    await env.ENTRIES.put(k, JSON.stringify(data));
    restored++;
  }
  return json({ ok: true, restored }, 200, {});
}

/* ---------------- Admin: draw ---------------- */

async function adminDraw(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, {});
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  if (!env.DISCORD_WEBHOOK_WINNERS) {
    return json({ error: "DISCORD_WEBHOOK_WINNERS not configured" }, 500, {});
  }
  const current = await getCurrent(env);
  if (!current) return json({ error: "No active giveaway — start one first" }, 400, {});

  let body = {};
  try { body = await request.json(); } catch {}
  const count = Math.max(1, Math.min(25, parseInt(body.count, 10) || 1));

  const all = await listAll(env);
  const pool = all.filter(e => eligible(e, current.name));
  if (pool.length === 0) {
    return json({ error: "No eligible entries in \"" + current.name + "\"" }, 400, {});
  }

  // Shuffle (Fisher–Yates with crypto randomness).
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Each entry is a ticket, but one person can't win twice in a draw.
  const winners = [];
  const seen = new Set();
  for (const entry of pool) {
    const person = entry.discordId || entry.discordUsername || entry.key;
    if (seen.has(person)) continue;
    seen.add(person);
    winners.push(entry);
    if (winners.length >= count) break;
  }

  const now = new Date().toISOString();
  const lines = winners.map(w => {
    const mention = w.discordId ? `<@${w.discordId}>` : "";
    const name = w.discordUsername || "Unknown";
    return `🏆 ${mention} **${name}** — ${w.accountSize || "—"} account`;
  });

  const announcement = {
    username: "Sy Trades Giveaway",
    embeds: [{
      title: winners.length === 1
        ? `🎉 ${current.name} — Winner!`
        : `🎉 ${current.name} — Winners (${winners.length})`,
      color: 0xf59e0b,
      description: lines.join("\n"),
      footer: { text: `Drawn from ${pool.length} eligible entries · ${current.name}` },
      timestamp: now
    }]
  };

  const res = await fetch(env.DISCORD_WEBHOOK_WINNERS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(announcement)
  });
  if (!res.ok) {
    return json({ error: "Discord rejected announcement", status: res.status }, 502, {});
  }

  // Mark winning entries so they can't win again in this giveaway.
  for (const w of winners) {
    const { key, inPool, ...data } = w;
    data.won = now;
    await env.ENTRIES.put(key, JSON.stringify(data));
  }

  // Keep a record of the draw.
  await env.ENTRIES.put(`draw:${now}`, JSON.stringify({
    ts: now,
    giveaway: current.name,
    poolSize: pool.length,
    winners: winners.map(w => ({
      discordUsername: w.discordUsername,
      discordId: w.discordId,
      accountSize: w.accountSize
    }))
  }));

  return json({
    ok: true,
    drawnAt: now,
    giveaway: current.name,
    poolSize: pool.length,
    winners: winners.map(w => ({
      discordUsername: w.discordUsername,
      accountSize: w.accountSize
    }))
  }, 200, {});
}

/* ---------------- Admin: page ---------------- */

function adminPage() {
  return new Response(ADMIN_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Sy Trades — Giveaway Admin</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background:#0f172a; color:#e2e8f0; margin:0; padding:2rem;
         display:flex; justify-content:center; }
  .card { background:#1e293b; border-radius:12px; padding:2rem;
          max-width:480px; width:100%; }
  h1 { font-size:1.25rem; margin:0 0 1.5rem; }
  label { display:block; font-size:.85rem; color:#94a3b8; margin:1rem 0 .25rem; }
  input { width:100%; box-sizing:border-box; padding:.6rem .75rem;
          border-radius:8px; border:1px solid #334155; background:#0f172a;
          color:#e2e8f0; font-size:1rem; }
  button { margin-top:1.25rem; width:100%; padding:.7rem;
           border:none; border-radius:8px; background:#2563eb; color:#fff;
           font-size:1rem; font-weight:600; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  .stats { background:#0f172a; border-radius:8px; padding:1rem;
           margin-top:1rem; font-size:.9rem; line-height:1.6; }
  .ok { color:#4ade80; } .err { color:#f87171; } .warn { color:#fbbf24; }
  ul { padding-left:1.25rem; }
  .btn-secondary { background:#334155; }
  .newgive { display:flex; gap:.6rem; align-items:flex-end; }
  .newgive > div { flex:1; }
  .newgive button { width:auto; margin-top:0; padding:.6rem 1rem; white-space:nowrap; }
  /* ---- entries modal ---- */
  .backdrop { position:fixed; inset:0; background:rgba(2,6,23,.7);
              display:none; align-items:center; justify-content:center; padding:1.5rem; z-index:10; }
  .backdrop.open { display:flex; }
  .modal { background:#1e293b; border-radius:12px; width:100%; max-width:680px;
           max-height:85vh; display:flex; flex-direction:column; }
  .modal header { display:flex; align-items:center; justify-content:space-between;
                  padding:1rem 1.25rem; border-bottom:1px solid #334155; }
  .modal header h2 { font-size:1rem; margin:0; }
  .modal header button { width:auto; margin:0; padding:.3rem .7rem; background:#334155; }
  .modal .body { overflow-y:auto; padding:1rem 1.25rem 1.25rem; }
  .grp { color:#94a3b8; font-size:.78rem; text-transform:uppercase; letter-spacing:.05em;
         margin:1.1rem 0 .5rem; display:flex; align-items:center; gap:.6rem; }
  .grp:first-child { margin-top:0; }
  .grp .cur { color:#4ade80; }
  .grp button { width:auto; margin:0; padding:.2rem .6rem; font-size:.7rem; background:#1d4ed8; }
  .erow { display:flex; align-items:center; gap:.75rem; background:#0f172a;
          border-radius:8px; padding:.6rem .8rem; margin-bottom:.5rem; font-size:.85rem; }
  .erow .who { flex:1; min-width:0; }
  .erow .who b { display:block; }
  .erow .who span { color:#94a3b8; font-size:.78rem; display:block;
                    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .erow .tag { font-size:.7rem; font-weight:700; padding:.15rem .5rem; border-radius:99px; }
  .erow .tag.pool { background:rgba(74,222,128,.15); color:#4ade80; }
  .erow .tag.won  { background:rgba(251,191,36,.15); color:#fbbf24; }
  .erow .tag.past { background:rgba(148,163,184,.15); color:#94a3b8; }
  .erow button { width:auto; margin:0; padding:.35rem .7rem; font-size:.78rem; }
  .erow .del { background:#7f1d1d; }
  .erow .res { background:#1d4ed8; }
</style>
</head>
<body>
<div class="card">
  <h1>🎁 Giveaway Admin</h1>
  <label>Admin key</label>
  <input id="key" type="password" placeholder="Admin key" autocomplete="off">
  <button id="load">Load giveaway</button>
  <div class="stats" id="stats" style="display:none"></div>
  <button id="view" class="btn-secondary" style="display:none">View &amp; manage entries</button>
  <div id="givewrap" style="display:none">
    <label>Start a new giveaway</label>
    <div class="newgive">
      <div><input id="gname" placeholder='e.g. "Giveaway #12 — June 18"'></div>
      <button id="gstart" class="btn-secondary">Start</button>
    </div>
  </div>
  <label>Number of winners</label>
  <input id="count" type="number" min="1" max="25" value="1">
  <button id="draw" disabled>Draw winners &amp; announce</button>
  <div class="stats" id="result" style="display:none"></div>
</div>

<div class="backdrop" id="backdrop">
  <div class="modal">
    <header>
      <h2>Entries</h2>
      <button id="closeModal">Close ✕</button>
    </header>
    <div class="body" id="modalBody">Loading…</div>
  </div>
</div>

<script>
  const $ = id => document.getElementById(id);
  const hdrs = () => ({ "x-admin-key": $("key").value,
                        "Content-Type": "application/json" });
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  $("load").onclick = async () => {
    $("stats").style.display = "block";
    $("stats").textContent = "Loading…";
    try {
      const r = await fetch("/admin/stats", { headers: hdrs() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      const g = d.giveaway;
      $("stats").innerHTML =
        (g ? 'Active giveaway: <b>' + esc(g.name) + '</b><br>Started: <b>' +
             new Date(g.startedAt).toLocaleString() + '</b><br>'
           : '<span class="warn">No active giveaway — start one below.</span><br>') +
        "Eligible entries: <b>" + d.entriesInPool + "</b> · " +
        "Unique people: <b>" + d.uniquePeople + "</b><br>" +
        "Total entries stored: <b>" + d.totalEntries + "</b>";
      $("draw").disabled = !g || d.entriesInPool === 0;
      $("view").style.display = "block";
      $("givewrap").style.display = "block";
    } catch (e) {
      $("stats").innerHTML = '<span class="err">Error: ' + e.message + "</span>";
      $("draw").disabled = true;
      $("view").style.display = "none";
      $("givewrap").style.display = "none";
    }
  };

  $("gstart").onclick = async () => {
    const name = $("gname").value.trim();
    if (!name) { alert("Enter a giveaway name first."); return; }
    if (!confirm('Start new giveaway "' + name + '"? New entries will count toward it; the previous pool becomes past entries.')) return;
    $("gstart").disabled = true;
    try {
      const r = await fetch("/admin/giveaway", {
        method: "POST", headers: hdrs(), body: JSON.stringify({ name })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      $("gname").value = "";
      $("load").click();
    } catch (err) { alert("Error: " + err.message); }
    $("gstart").disabled = false;
  };

  function row(e, currentName) {
    const when = e.ts ? new Date(e.ts).toLocaleString() : "";
    const tag = e.inPool ? '<span class="tag pool">In pool</span>'
      : (e.giveaway === currentName && e.won) ? '<span class="tag won">Won</span>'
      : '<span class="tag past">Past</span>';
    return '<div class="erow" data-key="' + esc(e.key) + '">' +
      '<div class="who"><b>' + esc(e.discordUsername || "Unknown") +
        (e.restoredFrom ? ' <span style="display:inline;color:#fbbf24;font-size:.7rem;">(restored)</span>' : '') + '</b>' +
      '<span>' + esc(e.firmName) + ' · ' + esc(e.accountSize || "—") +
        ' · #' + esc(e.orderId) + ' · ' + esc(e.fullName) + ' · ' + esc(when) + '</span></div>' +
      tag +
      (e.inPool ? '' : '<button class="res" data-act="restore">Restore</button>') +
      '<button class="del" data-act="delete">Delete</button>' +
      '</div>';
  }

  async function loadEntries() {
    $("modalBody").textContent = "Loading…";
    try {
      const r = await fetch("/admin/entries", { headers: hdrs() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);

      const groups = {};
      d.entries.forEach(e => {
        const g = e.giveaway || "Unassigned";
        (groups[g] = groups[g] || []).push(e);
      });
      const names = Object.keys(groups).sort((a, b) => {
        if (a === d.current) return -1;
        if (b === d.current) return 1;
        return groups[b][0].key < groups[a][0].key ? -1 : 1;
      });

      let html = "";
      if (!names.length) html = '<div style="color:#64748b;font-size:.85rem;">No entries stored yet.</div>';
      for (const n of names) {
        const list = groups[n];
        const isCur = n === d.current;
        const restorable = list.filter(e => !e.inPool).map(e => e.key);
        html += '<div class="grp">' +
          (isCur ? '<span class="cur">Current — ' + esc(n) + '</span>' : esc(n)) +
          ' (' + list.length + ')' +
          (!isCur && d.current && restorable.length
            ? '<button data-grp="' + esc(n) + '">Restore all → current</button>' : '') +
          '</div>';
        html += list.map(e => row(e, d.current)).join("");
      }
      $("modalBody").innerHTML = html;
      $("modalBody").dataset.current = d.current || "";
      window.__groups = groups;
    } catch (e) {
      $("modalBody").innerHTML = '<span class="err">Error: ' + e.message + "</span>";
    }
  }

  $("view").onclick = () => { $("backdrop").classList.add("open"); loadEntries(); };
  $("closeModal").onclick = () => { $("backdrop").classList.remove("open"); $("load").click(); };
  $("backdrop").addEventListener("click", e => {
    if (e.target === $("backdrop")) { $("backdrop").classList.remove("open"); $("load").click(); }
  });

  $("modalBody").addEventListener("click", async e => {
    const grpBtn = e.target.closest("button[data-grp]");
    if (grpBtn) {
      const g = grpBtn.getAttribute("data-grp");
      const keys = (window.__groups[g] || []).filter(x => !x.inPool).map(x => x.key);
      if (!keys.length) return;
      if (!confirm('Move all ' + keys.length + ' entries from "' + g + '" into the current giveaway?')) return;
      grpBtn.disabled = true;
      try {
        const r = await fetch("/admin/restore", {
          method: "POST", headers: hdrs(), body: JSON.stringify({ keys })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || r.status);
        loadEntries();
      } catch (err) { alert("Error: " + err.message); grpBtn.disabled = false; }
      return;
    }

    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const key = btn.closest(".erow").getAttribute("data-key");
    const act = btn.getAttribute("data-act");
    if (act === "delete" && !confirm("Delete this entry permanently?")) return;
    if (act === "restore" && !confirm("Move this entry into the current giveaway's pool?")) return;
    btn.disabled = true;
    try {
      const r = await fetch("/admin/" + act, {
        method: "POST", headers: hdrs(), body: JSON.stringify({ keys: [key] })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      loadEntries();
    } catch (err) { alert("Error: " + err.message); btn.disabled = false; }
  });

  $("draw").onclick = async () => {
    const n = $("count").value || 1;
    if (!confirm("Draw " + n + " winner(s) and post to Discord? Winners are excluded from future draws in this giveaway.")) return;
    $("draw").disabled = true;
    $("result").style.display = "block";
    $("result").textContent = "Drawing…";
    try {
      const r = await fetch("/admin/draw", {
        method: "POST", headers: hdrs(),
        body: JSON.stringify({ count: Number(n) })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      $("result").innerHTML =
        '<span class="ok">Posted to Discord! (' + esc(d.giveaway) + ')</span><ul>' +
        d.winners.map(w => "<li><b>" + esc(w.discordUsername || "Unknown") +
          "</b> — " + esc(w.accountSize || "—") + "</li>").join("") +
        "</ul>Pool size: " + d.poolSize;
      $("load").click();
    } catch (e) {
      $("result").innerHTML = '<span class="err">Error: ' + e.message + "</span>";
    }
    $("draw").disabled = false;
  };
</script>
</body>
</html>`;

/* ---------------- Util ---------------- */

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });
}
