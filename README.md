# Sy Trades — Prop Firm / Giveaway Site

A static, multi-page recreation of the reference site, rebranded for **Sy Trades**.
No build step, no server code — just HTML/CSS/JS you can host anywhere
(Netlify, Vercel, GitHub Pages, Cloudflare Pages, or any static host).

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Landing page (hero, top firms, info cards, trusted strip, giveaway CTA) |
| `giveaway.html` | **Enter the Giveaways** — Discord login + entry forms (Giveaway / Terms tabs) |
| `terms.html` | Standalone Terms of Service |
| `true-cost.html` | True Cost to Funding calculator (account-size selector) |
| `compare.html` | Prop Firm Comparison table |
| `beginner-guide.html` | A-Z Beginner Guide |
| `maximizing-payouts.html` | Maximizing Payouts guide |
| `js/config.js` | **The only file you need to edit** — all your settings live here |
| `js/data.js` | Firm directory, prices, discount %s (edit if prices change) |

## Quick start (local preview)

From inside the `sy-trades` folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

> Use a local server (not `file://`) so the Discord login redirect works correctly.

---

## ⚙️ Setup — everything is in `js/config.js`

Open `js/config.js` and fill in the values below.

### 1. Discord login (required for the giveaway)

The giveaway uses Discord's **OAuth2 implicit flow**, which runs entirely in the
browser — no backend or client secret needed.

1. Go to <https://discord.com/developers/applications> → **New Application**.
2. Copy the **Application ID** → paste into `discordClientId`.
3. Open **OAuth2 → Redirects** and add the **exact** URL of your hosted
   `giveaway.html`, e.g.
   - `https://yoursite.com/giveaway.html`
   - or for local testing: `http://localhost:8000/giveaway.html`

   It must match **byte-for-byte** (protocol, domain, path). Add one entry per
   environment you use.
4. (Optional) If auto-detection of the redirect ever misbehaves on your host,
   set `discordRedirectUri` to that exact URL.

```js
discordClientId: "123456789012345678",
discordRedirectUri: "", // leave "" to auto-use the current giveaway.html URL
```

### 2. Discord webhook (required to receive entries)

Every submitted entry is POSTed to a Discord channel via webhook.

1. In Discord, open the target channel → **Edit Channel → Integrations →
   Webhooks → New Webhook**.
2. Name it (e.g. "Giveaway Entries"), pick the channel, **Copy Webhook URL**.
3. Paste it into `discordWebhookUrl`.

```js
discordWebhookUrl: "https://discord.com/api/webhooks/XXXX/YYYY",
```

Each entry arrives as an embed containing: **Firm, Account Size, Discount Code,
Order Number, Full Name (on order), and the entrant's Discord username + ID.**

### 3. Invite link + socials

```js
discordInviteUrl: "https://discord.gg/your-invite",
socials: {
  youtube:   "https://youtube.com/@sytrades",
  twitter:   "https://x.com/sytrades",
  instagram: "https://instagram.com/sytrades",
  discord:   "https://discord.gg/your-invite"
}
```

### 4. Discount code

`discountCode` is set to **OZZ** and is used everywhere (banner, cards,
calculator, comparison). Change it in one place if needed.

---

## How the giveaway flow works

1. Visitor lands on `giveaway.html` → clicks **Connect Discord to Enter**.
2. Discord asks them to authorize (`identify` scope only — username + avatar).
3. They're redirected back; their profile shows as "Connected via Discord".
4. They pick the firm they used code **OZZ** on.
5. They enter **Account Size**, **Order Number**, and **Full Name used for the
   order**, then click **Add Entry**.
6. The entry is sent to your Discord channel webhook and listed under
   **My Entries**.

> Until you add real Discord values, the login button shows a setup reminder and
> entries are stored locally so you can still demo the UI. Once `config.js` is
> filled in, everything is live.

---

## Editing prices / firms

All firm names, links, discount %s, and the True-Cost price tables live in
`js/data.js`. Affiliate "Learn More" buttons currently point to each firm's
**official homepage** — swap the `site:` URLs for your affiliate links when ready.

## Notes / customization

- Logos are lightweight inline SVG placeholders. Drop real logo files into an
  `img/` folder and reference them in `js/data.js` if you prefer.
- Replace the mailing address placeholder in `js/terms.js` (section 1) before
  publishing the giveaway terms.
- Fonts (Anton + Inter) load from Google Fonts.
