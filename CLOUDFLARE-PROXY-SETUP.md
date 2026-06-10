# Set up the Giveaway Webhook Proxy (Cloudflare Worker)

**Goal:** hide the Discord webhook URL server-side. The website sends each
giveaway entry to a Cloudflare Worker; the Worker (holding the webhook as a
secret) forwards it to Discord. The webhook never reaches the browser.

This file is written so it can be handed to a Cowork/Chrome agent to execute in
the browser. The human owner must be signed in / approve account actions.

---

## Inputs you need before starting

| Value | Where it comes from |
|-------|--------------------|
| **Discord webhook URL** | Discord → target channel → Edit Channel → Integrations → Webhooks → New Webhook → "Copy Webhook URL". Looks like `https://discord.com/api/webhooks/123.../abc...` |
| **Site origin** | The site's public URL origin: `https://sytradesgiveaway.com` |
| **Worker code** | The file `worker/worker.js` in this repo — copy its full contents |

> Keep the webhook URL private. It is a secret. Do not paste it into any file
> that gets committed to GitHub — it only goes into the Cloudflare dashboard.

---

## Steps (Cloudflare dashboard)

1. Go to **https://dash.cloudflare.com** and sign in (create a free account if
   needed — no credit card required for Workers free tier).

2. In the left sidebar click **Workers & Pages**.

3. Click **Create application** → **Create Worker**.

4. Name it `sytrades-giveaway-proxy` (or similar). Click **Deploy** to create
   the starter worker.

5. Click **Edit code** (top right). In the editor, **select all and delete** the
   default code, then **paste the entire contents of `worker/worker.js`** from
   this repo. Click **Deploy** (or Save and Deploy).

6. Add the environment variables. Go to the Worker's **Settings → Variables and
   Secrets** (older UI: Settings → Variables):

   - Add a **Secret** named `DISCORD_WEBHOOK_URL` with the value = your Discord
     webhook URL. (Use "Encrypt"/Secret type, not plaintext.)
   - Add a **Text/Plaintext** variable named `ALLOWED_ORIGIN` with the value
     `https://sytradesgiveaway.com`
     (during testing you can temporarily use `*` to allow any origin).
   - Optional: add a **Secret** named `DISCORD_WEBHOOK_PUBLIC` with the webhook
     URL of a public feed channel. Each entry also posts a slim message there
     (Discord name + account size only). Omit it to disable the public feed.
   - Add a **Secret** named `DISCORD_WEBHOOK_WINNERS` with the webhook URL of
     the winners channel (used by the admin draw page).
   - Add a **Secret** named `ADMIN_KEY` with a long random string. This is the
     password for the admin draw page.

6b. Create the entry-log storage (needed for winner draws):
   - Storage & Databases → KV → Create namespace, e.g.
     `sytrades-giveaway-entries`.
   - On the Worker: Bindings → Add → KV namespace → variable name `ENTRIES`,
     select the namespace → Deploy.

## Winner draws

Open `https://<worker-url>/admin`, enter the `ADMIN_KEY`, click **Load entry
stats**, choose how many winners, then **Draw winners & announce**. The Worker
picks randomly from entries logged since the previous draw (each entry is a
ticket; the same person can't win twice in one draw), posts the announcement
(Discord name + account size) to the winners channel, and resets the window.
Draw history is kept in KV under `draw:<timestamp>`.

   Click **Deploy** / **Save** so the variables take effect.

7. Copy the Worker's public URL. It's shown on the Worker's overview page and
   looks like:
   ```
   https://sytrades-giveaway-proxy.<your-subdomain>.workers.dev
   ```

---

## Wire the site to the Worker

8. In this repo, open `js/config.js` and set:
   ```js
   entryProxyUrl: "https://sytrades-giveaway-proxy.<your-subdomain>.workers.dev",
   ```
   (Leave `discordWebhookUrl` as the placeholder — it's the fallback and is
   ignored once the proxy is set.)

9. Commit and push so GitHub Pages redeploys:
   ```bash
   git add js/config.js
   git commit -m "Use Cloudflare Worker proxy for giveaway entries"
   git push
   ```

---

## Test it

10. Open the live giveaway page (`/giveaway.html`), connect Discord, pick a
    firm, and submit a test entry with a fake order number + name. Confirm the
    embed appears in your Discord channel.

11. Quick direct test (optional), from a terminal:
    ```bash
    curl -i -X POST "https://sytrades-giveaway-proxy.<your-subdomain>.workers.dev" \
      -H "Content-Type: application/json" \
      -d '{"firmName":"Apex Trader Funding","accountSize":"50k","orderId":"TEST-123","fullName":"Test User","code":"OZZ","discordUsername":"tester","discordId":"000"}'
    ```
    Expect `HTTP/2 200` and `{"ok":true}`, with a message landing in Discord.

---

## Notes

- If entries fail with a CORS error in the browser console, double-check
  `ALLOWED_ORIGIN` exactly matches the site origin (scheme + host, no trailing
  slash, no path), then redeploy the Worker.
- To rotate the webhook later: delete it in Discord, create a new one, and
  update only the `DISCORD_WEBHOOK_URL` secret in Cloudflare. No site change or
  redeploy needed.
- The Worker also validates/length-caps input and rejects requests missing the
  required fields, which blunts casual abuse.
