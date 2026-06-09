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
  discordClientId: "YOUR_DISCORD_CLIENT_ID",

  // Optional: force a specific redirect URI. Leave "" to auto-use the current
  // giveaway.html URL (works for most static hosts).
  discordRedirectUri: "",

  // 4. Create a Webhook in your target Discord channel
  //    (Channel -> Edit -> Integrations -> Webhooks -> New Webhook -> Copy URL)
  discordWebhookUrl: "YOUR_DISCORD_WEBHOOK_URL",

  // Public invite link to your community server
  discordInviteUrl: "https://discord.gg/your-invite",

  // --- SOCIALS (footer) ---
  socials: {
    youtube:   "https://youtube.com/@sytrades",
    twitter:   "https://x.com/sytrades",
    instagram: "https://instagram.com/sytrades",
    discord:   "https://discord.gg/your-invite"
  }
};
