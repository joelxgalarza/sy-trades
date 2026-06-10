/* ============================================================
   Sy Trades — SITE CONFIG
   ------------------------------------------------------------
   Edit the values below. See README.md for the full setup guide.
   ============================================================ */
window.SY_CONFIG = {
  // Brand
  brandName: "SY TRADES",
  discountCode: "OZZ",

  // --- DISCORD (giveaway authentication) ---
  // 1. Create an app at https://discord.com/developers/applications
  // 2. Copy the "Application ID" -> paste below as discordClientId
  // 3. In OAuth2 settings, add a Redirect to the EXACT url of giveaway.html
  //    (e.g. https://yoursite.com/giveaway.html). It must match byte-for-byte.
  discordClientId: "1514088240548679840",

  // Optional: force a specific redirect URI. Leave "" to auto-use the current
  // giveaway.html URL (works for most static hosts).
  discordRedirectUri: "",

  // --- WHERE GIVEAWAY ENTRIES ARE SENT ---
  // RECOMMENDED: a Cloudflare Worker proxy that keeps the webhook URL secret
  // server-side. Paste the Worker URL here (see CLOUDFLARE-PROXY-SETUP.md).
  // When this is set, the webhook below is NOT used by the browser.
  entryProxyUrl: "https://sytrades-giveaway-proxy.swe-88c.workers.dev",

  // FALLBACK (only used if entryProxyUrl is left as "YOUR_WORKER_URL"):
  // a Discord channel webhook the browser posts to directly. Simpler, but the
  // URL is visible in client-side JS. (Channel -> Edit -> Integrations ->
  // Webhooks -> New Webhook -> Copy URL)
  discordWebhookUrl: "YOUR_DISCORD_WEBHOOK_URL",

  // Public invite link to your community server
  discordInviteUrl: "https://discord.gg/rWaP7bEWZ",

  // --- SOCIALS (footer) ---
  socials: {
    youtube:   "https://youtube.com/@sytrades",
    twitter:   "https://x.com/sytrades",
    instagram: "https://instagram.com/sytrades",
    discord:   "https://discord.gg/rWaP7bEWZ"
  }
};
