/* ============================================================
   Sy Trades — Giveaway entry proxy + winner draw (Cloudflare Worker)
   ------------------------------------------------------------
   POST /            — receives a giveaway entry from the website,
                       logs it to KV, and forwards it to Discord.
   GET  /admin       — admin page (winner drawing).
   GET  /admin/stats — entries since last draw (requires admin key).
   POST /admin/draw  — draws N winners from entries since the last
                       draw, posts them to the winners channel, and
                       resets the draw window (requires admin key).

   Bindings (set in the Cloudflare dashboard):
     ENTRIES                 (KV namespace) — entry log + draw state
   Environment variables:
     DISCORD_WEBHOOK_URL     (Secret) — full-details entries channel webhook
     DISCORD_WEBHOOK_PUBLIC  (Secret, optional) — public feed channel webhook;
                                        gets Discord name + account size only
     DISCORD_WEBHOOK_WINNERS (Secret) — winners channel webhook
     ADMIN_KEY               (Secret) — key required to use /admin
     ALLOWED_ORIGIN          (Text)   — site origin, e.g.
                                        https://sytradesgiveaway.com
   ============================================================ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin") return adminPage();
    if (url.pathname === "/admin/stats") return adminStats(request, env);
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
            ? `${discordUsername} (\`${discordId}\`)` : "—", inline: true }
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
        ts, firmName, accountSize, orderId, fullName, code,
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

async function listEntriesSince(env, sinceIso) {
  // ISO timestamps sort lexicographically, so key comparison works.
  const floor = sinceIso ? `entry:${sinceIso}` : "entry:";
  const keys = [];
  let cursor;
  do {
    const page = await env.ENTRIES.list({ prefix: "entry:", cursor });
    for (const k of page.keys) {
      if (!sinceIso || k.name > floor) keys.push(k.name);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  const entries = [];
  for (const name of keys) {
    const raw = await env.ENTRIES.get(name);
    if (raw) {
      try { entries.push({ key: name, ...JSON.parse(raw) }); } catch {}
    }
  }
  return entries;
}

/* ---------------- Admin: stats ---------------- */

async function adminStats(request, env) {
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  const lastDraw = await env.ENTRIES.get("meta:lastDraw");
  const entries = await listEntriesSince(env, lastDraw);
  const people = new Set(
    entries.map(e => e.discordId || e.discordUsername || e.key)
  );
  return json({
    lastDraw: lastDraw || null,
    entriesSinceLastDraw: entries.length,
    uniquePeople: people.size
  }, 200, {});
}

/* ---------------- Admin: draw ---------------- */

async function adminDraw(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, {});
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401, {});
  if (!env.ENTRIES) return json({ error: "KV not bound" }, 500, {});
  if (!env.DISCORD_WEBHOOK_WINNERS) {
    return json({ error: "DISCORD_WEBHOOK_WINNERS not configured" }, 500, {});
  }

  let body = {};
  try { body = await request.json(); } catch {}
  const count = Math.max(1, Math.min(25, parseInt(body.count, 10) || 1));

  const lastDraw = await env.ENTRIES.get("meta:lastDraw");
  const pool = await listEntriesSince(env, lastDraw);
  if (pool.length === 0) {
    return json({ error: "No entries since the last draw" }, 400, {});
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
        ? "🎉 Giveaway Winner!"
        : `🎉 Giveaway Winners (${winners.length})`,
      color: 0xf59e0b,
      description: lines.join("\n"),
      footer: { text: `Drawn from ${pool.length} entries` },
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

  // Reset the draw window and keep a record.
  await env.ENTRIES.put("meta:lastDraw", now);
  await env.ENTRIES.put(`draw:${now}`, JSON.stringify({
    ts: now,
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
  .ok { color:#4ade80; } .err { color:#f87171; }
  ul { padding-left:1.25rem; }
</style>
</head>
<body>
<div class="card">
  <h1>🎁 Giveaway Admin</h1>
  <label>Admin key</label>
  <input id="key" type="password" placeholder="Admin key" autocomplete="off">
  <button id="load">Load entry stats</button>
  <div class="stats" id="stats" style="display:none"></div>
  <label>Number of winners</label>
  <input id="count" type="number" min="1" max="25" value="1">
  <button id="draw" disabled>Draw winners &amp; announce</button>
  <div class="stats" id="result" style="display:none"></div>
</div>
<script>
  const $ = id => document.getElementById(id);
  const hdrs = () => ({ "x-admin-key": $("key").value,
                        "Content-Type": "application/json" });

  $("load").onclick = async () => {
    $("stats").style.display = "block";
    $("stats").textContent = "Loading…";
    try {
      const r = await fetch("/admin/stats", { headers: hdrs() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || r.status);
      $("stats").innerHTML =
        "Entries since last draw: <b>" + d.entriesSinceLastDraw + "</b><br>" +
        "Unique people: <b>" + d.uniquePeople + "</b><br>" +
        "Last draw: <b>" + (d.lastDraw ? new Date(d.lastDraw).toLocaleString() : "never") + "</b>";
      $("draw").disabled = d.entriesSinceLastDraw === 0;
    } catch (e) {
      $("stats").innerHTML = '<span class="err">Error: ' + e.message + "</span>";
      $("draw").disabled = true;
    }
  };

  $("draw").onclick = async () => {
    const n = $("count").value || 1;
    if (!confirm("Draw " + n + " winner(s) and post to Discord? This resets the entry window.")) return;
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
        '<span class="ok">Posted to Discord!</span><ul>' +
        d.winners.map(w => "<li><b>" + (w.discordUsername || "Unknown") +
          "</b> — " + (w.accountSize || "—") + "</li>").join("") +
        "</ul>Pool size: " + d.poolSize;
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
