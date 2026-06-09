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
    mff:   `<svg viewBox="0 0 48 48"><path d="M24 6 8 12v9c0 11 7 18 16 21 9-3 16-10 16-21v-9L24 6z" fill="#f5b301"/><path d="M16 22h16v4H16zm0 7h16v4H16z" fill="#1c1c1f"/></svg>`,
    lucid: `<svg viewBox="0 0 48 48"><defs><radialGradient id="lg" cx="38%" cy="34%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#7c8aa0"/></radialGradient></defs><circle cx="24" cy="24" r="16" fill="url(#lg)"/></svg>`,
    tpt:   `<svg viewBox="0 0 48 48"><rect x="9" y="14" width="3" height="20" fill="#ef4444"/><rect x="9" y="18" width="3" height="9" fill="#ef4444"/><rect x="22" y="10" width="3" height="28" fill="#22c55e"/><rect x="22" y="16" width="3" height="14" fill="#22c55e"/><rect x="35" y="14" width="3" height="20" fill="#3b82f6"/><rect x="35" y="18" width="3" height="9" fill="#3b82f6"/><rect x="6" y="11" width="36" height="2" fill="#fff"/></svg>`,
    tradeify: `<svg viewBox="0 0 48 48"><path d="M14 30c2-8 7-13 13-15M16 33c3-7 8-11 14-12" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 34l4 4 6-2 5 3 6-4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    ft:    `<svg viewBox="0 0 48 48"><rect x="10" y="13" width="20" height="3.4" fill="#fff"/><rect x="10" y="22" width="14" height="3.4" fill="#fff"/><rect x="10" y="31" width="22" height="3.4" fill="#fff"/><circle cx="35" cy="14.6" r="2.6" fill="#3b82f6"/><circle cx="29" cy="23.6" r="2.6" fill="#3b82f6"/><circle cx="37" cy="32.6" r="2.6" fill="#3b82f6"/></svg>`,
    fff:   `<svg viewBox="0 0 48 48"><path d="M12 10h22l-5 7H17v6h11l-5 7H17v8h-5V10z" fill="#19c39c"/></svg>`
  };

  // Firm directory (links go to real firm homepages per request)
  const firms = {
    apex:     { name: "Apex Trader Funding", site: "https://apextraderfunding.com", logo: glyph.apex },
    alpha:    { name: "Alpha Futures",       site: "https://thealphafutures.com",   logo: glyph.alpha },
    mff:      { name: "My Funded Futures",   site: "https://myfundedfutures.com",   logo: glyph.mff },
    lucid:    { name: "Lucid Trading",       site: "https://lucidtrading.com",      logo: glyph.lucid },
    tpt:      { name: "Take Profit Trader",  site: "https://takeprofittrader.com",  logo: glyph.tpt },
    tradeify: { name: "Tradeify",            site: "https://tradeify.co",           logo: glyph.tradeify },
    ft:       { name: "FundingTicks",        site: "https://fundingticks.com",      logo: glyph.ft },
    fff:      { name: "Funded Futures Family",site: "https://fundedfuturesfamily.com", logo: glyph.fff }
  };

  // Discount % per firm (single code "OZZ" everywhere)
  const discounts = {
    apex: 80, alpha: 10, mff: 20, lucid: 30, tpt: 40, tradeify: 33, ft: 40, fff: 25
  };

  // True Cost to Funding tables: [firmKey, evalCost, activationFee]
  const trueCost = {
    "25K":  [["apex",167,0],["lucid",60,0],["tpt",150,0],["tradeify",175,0],["ft",99,0]],
    "50K":  [["apex",187,0],["alpha",99,0],["mff",77,0],["lucid",80,0],["tpt",170,0],["tradeify",250,0],["ft",125,0]],
    "100K": [["apex",297,0],["alpha",199,0],["mff",267,0],["lucid",193,0],["tpt",330,0],["tradeify",440,0],["ft",199,0]],
    "150K": [["apex",397,0],["alpha",239,149],["mff",377,0],["lucid",259,0],["tpt",360,0],["tradeify",510,0]],
    "250K": [["apex",497,0]],
    "300K": [["apex",597,0]]
  };

  // Landing "Top Rated Firms" cards (with ribbons)
  const topRated = [
    { key:"alpha", ribbon:"Ending soon", soon:true },
    { key:"apex",  ribbon:"Ends on 7/8", soon:false },
    { key:"mff",   ribbon:"Ending soon", soon:true },
    { key:"tpt",   ribbon:"Ending soon", soon:true },
    { key:"tradeify", ribbon:"Ends 6/30", soon:false }
  ];

  // Trusted-by strip
  const trustedStrip = ["mff","fff","tpt","tradeify","apex"];

  // Giveaway firms + per-firm entry guidance
  const giveawayFirms = [
    { key:"alpha",    instr:"In your entries, ensure to enter the exact Order number as shown in the subject of the email you received from Alpha Futures." },
    { key:"lucid",    instr:"In your entries, ensure to enter the exact Order number as shown in the email you received from Lucid Trading." },
    { key:"mff",      instr:"In your entries, ensure to enter the exact Order number as shown in the MyFundedFutures account dashboard." },
    { key:"tpt",      instr:"In your entries, ensure to enter the exact Order number as shown in the subject of the email you received from Take Profit Trader." },
    { key:"tradeify", instr:"In your entries, ensure to enter the exact Order number as shown in the subject of the email you received from Tradeify." },
    { key:"fff",      instr:"In your entries, ensure to enter the exact Order number / Transaction ID as shown in the email you received from Funded Futures Family." }
  ];

  const accountSizes = ["25k","50k","100k","150k","250k","300k"];

  window.SY_DATA = {
    code: CODE, firms, discounts, trueCost, topRated, trustedStrip,
    giveawayFirms, accountSizes,
    sizeOrder: ["25K","50K","100K","150K","250K","300K"]
  };
})();
