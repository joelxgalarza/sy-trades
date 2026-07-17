/* ============================================================
   Sy Trades — DATA
   Firm directory, discount %s, true-cost tables, giveaway firms.
   Prices mirror the reference site. Discount CODE is pulled from
   config (OZZ). Update freely.
   ============================================================ */
(function () {
  const CODE = (window.SY_CONFIG && window.SY_CONFIG.discountCode) || "OZZ";

  // Simple inline SVG glyph logos (monochrome, theme-friendly)
  const glyph = {
    apex:  `<svg viewBox="0 0 48 48" fill="none"><path d="M6 34 24 8l18 26-7 0-11-16-7 10 6 0 4 6z" fill="#3b82f6"/></svg>`,
    alpha: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 8 8 40h7l9-20 9 20h7L24 8zm0 19-4 9h8l-4-9z" fill="#fff"/></svg>`,
    lucid: `<svg viewBox="0 0 48 48"><defs><radialGradient id="lg" cx="38%" cy="34%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#7c8aa0"/></radialGradient></defs><circle cx="24" cy="24" r="16" fill="url(#lg)"/></svg>`,
    tradeify: `<svg viewBox="0 0 48 48"><path d="M14 30c2-8 7-13 13-15M16 33c3-7 8-11 14-12" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 34l4 4 6-2 5 3 6-4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    tpt:   `<svg viewBox="0 0 48 48" fill="none"><path d="M6 34 20 20l7 7L40 14" stroke="#22c55e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 13h9v9" stroke="#22c55e" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  // Firm directory (links go to real firm homepages per request)
  const firms = {
    apex:     { name: "Apex Trader Funding", site: "https://apextraderfunding.com", logo: glyph.apex },
    alpha:    { name: "Alpha Futures",       site: "https://thealphafutures.com",   logo: glyph.alpha },
    lucid:    { name: "Lucid Trading",       site: "https://lucidtrading.com",      logo: glyph.lucid },
    tradeify: { name: "Tradeify",            site: "https://tradeify.co",           logo: glyph.tradeify },
    tpt:      { name: "Take Profit Trader",  site: "https://takeprofittrader.com",  logo: glyph.tpt }
  };

  // Discount % per firm (single code "OZZ" everywhere)
  const discounts = {
    apex: 80, alpha: 10, lucid: 30, tradeify: 33, tpt: 40
  };

  // True Cost to Funding tables: [firmKey, evalCost, activationFee]
  const trueCost = {
    "25K":  [["apex",167,0],["lucid",60,0],["tradeify",175,0],["tpt",150,130]],
    "50K":  [["apex",187,0],["alpha",99,0],["lucid",80,0],["tradeify",250,0],["tpt",170,130]],
    "100K": [["apex",297,0],["alpha",199,0],["lucid",193,0],["tradeify",440,0],["tpt",330,130]],
    "150K": [["apex",397,0],["alpha",239,149],["lucid",259,0],["tradeify",510,0],["tpt",360,130]],
    "250K": [["apex",497,0]],
    "300K": [["apex",597,0]]
  };

  // Landing "Top Rated Firms" cards (with ribbons)
  const topRated = [
    { key:"apex",     ribbon:"Ends on 7/8", soon:false },
    { key:"lucid",    ribbon:"Ending soon", soon:true },
    { key:"tpt",      ribbon:"Ending soon", soon:true },
    { key:"tradeify", ribbon:"Ends 6/30", soon:false },
    { key:"alpha",    ribbon:"Ending soon", soon:true }
  ];

  // Trusted-by strip
  const trustedStrip = ["apex","lucid","tradeify","alpha","tpt"];

  // Giveaway firms + per-firm entry guidance
  const giveawayFirms = [
    { key:"apex",     instr:"In your entries, ensure to enter the exact Order number as shown in the purchase confirmation email you received from Apex Trader Funding." },
    { key:"lucid",    instr:"In your entries, ensure to enter the exact Order number as shown in the email you received from Lucid Trading." },
    { key:"tradeify", instr:"In your entries, ensure to enter the exact Order number as shown in the subject of the email you received from Tradeify." },
    { key:"alpha",    instr:"In your entries, ensure to enter the exact Order number as shown in the subject of the email you received from Alpha Futures." },
    { key:"tpt",      instr:"In your entries, ensure to enter the exact Order number as shown in the purchase confirmation email you received from Take Profit Trader." }
  ];

  const accountSizes = ["25k","50k","100k","150k","250k","300k"];

  window.SY_DATA = {
    code: CODE, firms, discounts, trueCost, topRated, trustedStrip,
    giveawayFirms, accountSizes,
    sizeOrder: ["25K","50K","100K","150K","250K","300K"]
  };
})();
