/* ============================================================
   Sy Trades — Giveaway logic
   - Discord OAuth2 (implicit grant, fully client-side)
   - Per-firm entry forms (account size, order ID, full name)
   - Submissions POSTed to a Discord channel via webhook
   ============================================================ */
(function () {
  const CFG = window.SY_CONFIG || {};
  const D = window.SY_DATA;
  const CODE = D.code;

  const CLIENT_ID = CFG.discordClientId || "";
  const WEBHOOK = CFG.discordWebhookUrl || "";
  // Optional server-side proxy (Cloudflare Worker) that hides the webhook.
  // When set, entries are sent here instead of straight to Discord.
  const PROXY = CFG.entryProxyUrl || "";
  const INVITE = CFG.discordInviteUrl || "#";
  const REDIRECT = CFG.discordRedirectUri ||
    (window.location.origin + window.location.pathname);

  const isConfigured = CLIENT_ID && CLIENT_ID !== "YOUR_DISCORD_CLIENT_ID";

  // ---------- session helpers ----------
  const getUser = () => {
    try { return JSON.parse(sessionStorage.getItem("sy_user") || "null"); }
    catch { return null; }
  };
  const setUser = (u) => sessionStorage.setItem("sy_user", JSON.stringify(u));
  const clearUser = () => { sessionStorage.removeItem("sy_user"); sessionStorage.removeItem("sy_entries"); };

  const getEntries = () => {
    try { return JSON.parse(sessionStorage.getItem("sy_entries") || "[]"); }
    catch { return []; }
  };
  const setEntries = (e) => sessionStorage.setItem("sy_entries", JSON.stringify(e));

  // ---------- OAuth: catch returning token ----------
  function handleAuthRedirect() {
    if (!window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");
    if (!token) return;
    // clean the URL immediately
    history.replaceState(null, "", window.location.pathname + window.location.search);
    fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(u => {
        const avatar = u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${(Number(u.discriminator)||0)%5}.png`;
        setUser({
          id: u.id,
          username: u.global_name || u.username,
          handle: u.username,
          avatar
        });
        render();
      })
      .catch(() => { render(); });
  }

  function login() {
    if (!isConfigured) {
      alert("Discord login isn't configured yet.\n\nAdd your Application ID to js/config.js (discordClientId) and register the redirect URI. See README.md.");
      return;
    }
    const url = "https://discord.com/oauth2/authorize"
      + "?client_id=" + encodeURIComponent(CLIENT_ID)
      + "&redirect_uri=" + encodeURIComponent(REDIRECT)
      + "&response_type=token"
      + "&scope=identify";
    window.location.href = url;
  }

  // ---------- submit entry ----------
  // Preferred path: POST raw entry to the Cloudflare Worker proxy, which holds
  // the webhook URL server-side and builds the Discord message itself.
  // Fallback path: if no proxy is set but a webhook is, POST straight to Discord
  // (webhook visible client-side — fine for low-stakes, see README/SECURITY).
  async function sendToWebhook(entry, user) {
    const firm = D.firms[entry.firmKey];
    const proxySet = PROXY && PROXY !== "YOUR_WORKER_URL";
    const webhookSet = WEBHOOK && WEBHOOK !== "YOUR_DISCORD_WEBHOOK_URL";

    if (proxySet) {
      // send a flat, validated payload; the Worker formats + forwards it
      const body = {
        firmKey: entry.firmKey,
        firmName: firm.name,
        accountSize: entry.size,
        orderId: entry.orderId,
        fullName: entry.fullName,
        code: CODE,
        discordUsername: user.username,
        discordId: user.id
      };
      try {
        const res = await fetch(PROXY, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        return { ok: res.ok, reason: res.ok ? "" : ("proxy-" + res.status) };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    }

    if (webhookSet) {
      const payload = {
        username: "Sy Trades Giveaway",
        embeds: [{
          title: "🎉 New Giveaway Entry",
          color: 0x2563eb,
          fields: [
            { name: "Firm", value: firm.name, inline: true },
            { name: "Account Size", value: entry.size, inline: true },
            { name: "Discount Code", value: CODE, inline: true },
            { name: "Order Number", value: "`" + entry.orderId + "`", inline: false },
            { name: "Full Name (on order)", value: entry.fullName, inline: true },
            { name: "Discord", value: `${user.username} (\`${user.id}\`)`, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      };
      try {
        const res = await fetch(WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        return { ok: res.ok, reason: res.ok ? "" : ("http-" + res.status) };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    }

    return { ok: false, reason: "no-webhook" };
  }

  // ---------- rendering ----------
  const root = document.getElementById("giveawayRoot");
  let activeFirm = null; // firmKey currently expanded

  function firmLogo(key, big) {
    return `<div class="${big ? 'fa-logo' : 'fi-logo'}">${D.firms[key].logo}</div>`;
  }

  function renderEntries(user) {
    const entries = getEntries();
    if (!entries.length) {
      return `<div class="entries-empty">
        <div class="box-ico">📥</div>
        <div>No entries yet</div>
        <div style="font-size:13px;">Submit your first entry below</div>
      </div>`;
    }
    return entries.map(e => `
      <div class="entry-row">
        <div>
          <div class="er-firm">${D.firms[e.firmKey].name}</div>
          <div class="er-meta">${e.size} • Order ${e.orderId} • ${e.fullName}</div>
        </div>
        <span class="er-badge">1 entry</span>
      </div>`).join("");
  }

  function renderFirmSelector() {
    return `<div class="panel">
      <div class="firm-select-q">Which firm did you use code ${CODE} on?
        <small>Select a firm to submit your entries</small></div>
      <div class="firm-select-list">
        ${D.giveawayFirms.map(g => `
          <div class="firm-select-item" data-firm="${g.key}">
            ${firmLogo(g.key,false)}
            <span class="fi-name">${D.firms[g.key].name}</span>
            <span class="fi-arrow">→</span>
          </div>`).join("")}
      </div>
    </div>`;
  }

  function renderEntryForm(key) {
    const g = D.giveawayFirms.find(x => x.key === key);
    return `<div class="panel">
      <div class="firm-active-head">
        ${firmLogo(key,true)}
        <div>
          <h3>${D.firms[key].name}</h3>
          <div class="fa-sub">Submit your entries</div>
        </div>
        <button class="change-btn" id="changeFirm">← Change</button>
      </div>
      <p class="firm-instructions">${g.instr}</p>

      <div class="form-group">
        <label>Account Size</label>
        <select class="form-control" id="entrySize">
          ${D.accountSizes.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>Order Number</label>
        <input class="form-control" id="entryOrder" placeholder="Enter Order ID" autocomplete="off">
      </div>
      <div class="form-group">
        <label>Full Name Used For Order</label>
        <input class="form-control" id="entryName" placeholder="Enter full name on the order" autocomplete="off">
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost" id="cancelEntry">Cancel</button>
        <button class="btn" id="submitEntry">Add Entry</button>
      </div>
      <div class="form-msg" id="formMsg"></div>
    </div>`;
  }

  function render() {
    const user = getUser();
    const entries = getEntries();

    // Notice line (always)
    let html = `<div class="notice">
      <span class="i">i</span>
      <div>Every evaluation + reset purchased using code <strong>"${CODE}"</strong> = <strong>1 entry</strong>.*</div>
    </div>`;

    if (!user) {
      // Not connected
      html += `<button class="btn btn-discord btn-block" id="connectBtn" style="margin-top:18px;padding:15px;">
        💬 Connect Discord to Enter</button>`;
      html += `<div style="margin-top:18px;">` + renderFirmSelectorLocked() + `</div>`;
    } else {
      // Connected: user card + entries
      html += `<div class="panel" style="margin-top:18px;">
        <div class="discord-user">
          <img src="${user.avatar}" alt="">
          <span class="du-status"></span>
          <div>
            <div class="du-name">${user.username}</div>
            <div class="du-sub">Connected via Discord</div>
          </div>
          <button class="disconnect-btn" id="disconnectBtn">↪ Disconnect</button>
        </div>
        <div class="entries-head">🏆 My Entries <span class="count">${entries.length}</span></div>
        ${renderEntries(user)}
      </div>`;

      // firm selector or active form
      html += `<div style="margin-top:18px;">` +
        (activeFirm ? renderEntryForm(activeFirm) : renderFirmSelector()) +
        `</div>`;
    }

    // Join discord box (always)
    html += `<div class="panel join-box" style="margin-top:18px;">
      <p>Not in our Discord?</p>
      <a class="btn btn-ghost" href="${INVITE}" target="_blank" rel="noopener">💬 Join Our Discord</a>
    </div>`;

    root.innerHTML = html;
    wire();
  }

  // selector shown (greyed) before connecting
  function renderFirmSelectorLocked() {
    return `<div class="panel">
      <div class="firm-select-q">Which firm did you use code ${CODE} on?
        <small>Select a firm to submit your entries</small></div>
      <div class="firm-select-list" style="opacity:.85;">
        ${D.giveawayFirms.map(g => `
          <div class="firm-select-item" data-firm-locked="${g.key}">
            ${firmLogo(g.key,false)}
            <span class="fi-name">${D.firms[g.key].name}</span>
            <span class="fi-arrow">→</span>
          </div>`).join("")}
      </div>
      <div style="text-align:center;color:var(--text-dimmer);font-size:13px;padding-top:14px;border-top:1px solid var(--border);margin-top:6px;">
        Connect your Discord account to continue</div>
    </div>`;
  }

  function wire() {
    const cb = document.getElementById("connectBtn");
    if (cb) cb.addEventListener("click", login);

    const db = document.getElementById("disconnectBtn");
    if (db) db.addEventListener("click", () => { clearUser(); activeFirm = null; render(); });

    // locked items prompt login
    root.querySelectorAll("[data-firm-locked]").forEach(el =>
      el.addEventListener("click", login));

    // firm select
    root.querySelectorAll("[data-firm]").forEach(el =>
      el.addEventListener("click", () => { activeFirm = el.getAttribute("data-firm"); render(); }));

    const changeBtn = document.getElementById("changeFirm");
    if (changeBtn) changeBtn.addEventListener("click", () => { activeFirm = null; render(); });

    const cancel = document.getElementById("cancelEntry");
    if (cancel) cancel.addEventListener("click", () => { activeFirm = null; render(); });

    const submit = document.getElementById("submitEntry");
    if (submit) submit.addEventListener("click", onSubmit);
  }

  async function onSubmit() {
    const size = document.getElementById("entrySize").value;
    const orderId = document.getElementById("entryOrder").value.trim();
    const fullName = document.getElementById("entryName").value.trim();
    const msg = document.getElementById("formMsg");
    const btn = document.getElementById("submitEntry");

    msg.className = "form-msg";
    if (!orderId) { msg.className = "form-msg error"; msg.textContent = "Please enter your order number."; return; }
    if (!fullName) { msg.className = "form-msg error"; msg.textContent = "Please enter the full name used on the order."; return; }

    const user = getUser();
    const entry = { firmKey: activeFirm, size, orderId, fullName, ts: Date.now() };

    btn.disabled = true; btn.textContent = "Submitting…";
    const res = await sendToWebhook(entry, user);
    btn.disabled = false; btn.textContent = "Add Entry";

    if (!res.ok && res.reason === "no-webhook") {
      msg.className = "form-msg error";
      msg.textContent = "Webhook not configured yet — entry saved locally. Add discordWebhookUrl in js/config.js (see README).";
      // still record locally so the flow is demonstrable
      const entries = getEntries(); entries.push(entry); setEntries(entries);
      activeFirm = null; setTimeout(render, 1800);
      return;
    }
    if (!res.ok) {
      msg.className = "form-msg error";
      msg.textContent = "Could not submit (" + res.reason + "). Please try again.";
      return;
    }

    const entries = getEntries(); entries.push(entry); setEntries(entries);
    msg.className = "form-msg success";
    msg.textContent = "Entry submitted! 🎉";
    activeFirm = null;
    setTimeout(render, 1100);
  }

  // ---------- boot ----------
  handleAuthRedirect();
  render();
})();
