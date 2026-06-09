# Deploying Sy Trades

This is a static site (no build step). The repo root **is** the website.
Pick one path below. GitHub Pages is the primary, fully-automated option.

---

## Option A — GitHub Pages (recommended, auto-deploys on every push)

A workflow at `.github/workflows/deploy-pages.yml` is already included. It
publishes the repo root on every push to `main`.

### 1. Create the repo and push

Open a terminal **inside the `sy-trades` folder** and run:

```bash
git init
git add .
git commit -m "Initial commit: Sy Trades site"
git branch -M main
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/YOUR_USERNAME/sy-trades.git
git push -u origin main
```

> No GitHub CLI? Create the empty repository at
> <https://github.com/new> (leave "Add a README" unchecked), then run the
> commands above with your repo URL.

### 2. Turn on Pages

On GitHub: **Settings → Pages → Build and deployment → Source → "GitHub
Actions".** That's it — the included workflow takes over.

### 3. Watch it deploy

Go to the **Actions** tab. When the "Deploy to GitHub Pages" run finishes
(green check), your live URL appears in the workflow summary and under
**Settings → Pages**. It will look like:

```
https://YOUR_USERNAME.github.io/sy-trades/
```

### 4. Wire up Discord (required for the giveaway)

- In `js/config.js`, fill in `discordClientId`, `discordWebhookUrl`,
  `discordInviteUrl`. Commit + push — Pages redeploys automatically.
- In the [Discord Developer Portal](https://discord.com/developers/applications)
  → your app → **OAuth2 → Redirects**, add your live giveaway URL **exactly**:

  ```
  https://YOUR_USERNAME.github.io/sy-trades/giveaway.html
  ```

  It must match byte-for-byte (scheme, host, path). For local testing you can
  also add `http://localhost:8000/giveaway.html`.

Done. Every future `git push` redeploys the site.

---

## Option B — Netlify (drag & drop, or Git-connected)

**Fastest:** go to <https://app.netlify.com/drop> and drag the `sy-trades`
folder onto the page. You get an instant `*.netlify.app` HTTPS URL.

**Git-connected:** "Add new site → Import an existing project → pick this repo."
`netlify.toml` is already set (`publish = "."`, no build command).

Then add `https://YOUR-SITE.netlify.app/giveaway.html` as a Discord redirect URI
(step 4 above).

---

## Option C — Vercel

"Add New → Project → import this repo." When asked for a framework, choose
**Other** (no build). `vercel.json` keeps the `.html` extensions working.

Then add `https://YOUR-SITE.vercel.app/giveaway.html` as a Discord redirect URI.

---

## Custom domain (optional)

1. Buy a domain (Namecheap, Cloudflare, Google Domains, etc.).
2. Point it at your host:
   - **GitHub Pages:** Settings → Pages → Custom domain, then add the DNS
     records GitHub shows (an `A`/`CNAME` set). A `CNAME` file is created for you.
   - **Netlify/Vercel:** Domains tab → add domain → follow the DNS instructions.
3. **Add the custom-domain giveaway URL as another Discord redirect URI**, e.g.
   `https://sytrades.com/giveaway.html`. You can have multiple redirect URIs
   registered at once.

---

## Pre-launch checklist

- [ ] `js/config.js` has real `discordClientId` + `discordWebhookUrl`
- [ ] Discord OAuth2 redirect URI matches the live `giveaway.html` URL exactly
- [ ] Tested: Connect Discord → pick firm → submit entry → it lands in your channel
- [ ] Replaced the mailing-address placeholder in `js/terms.js` (section 1)
- [ ] Swapped firm `site:` URLs in `js/data.js` for your affiliate links (optional)
- [ ] Updated social links in `js/config.js`
