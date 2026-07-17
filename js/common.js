/* ============================================================
   Sy Trades — shared chrome (banner, header, dropdown, footer)
   Injects into [data-banner], [data-header], [data-footer].
   ============================================================ */
(function () {
  const CFG = window.SY_CONFIG || {};
  const CODE = CFG.discountCode || "OZZ";
  const INVITE = CFG.discordInviteUrl || "#";
  const S = CFG.socials || {};

  // Bull / longhorn-style logo mark
  const BULL = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 20c6-2 11 1 14 6 3-4 7-6 12-6s9 2 12 6c3-5 8-8 14-6-4 3-6 7-7 12-3 9-12 16-19 16S16 41 13 32C12 27 10 23 6 20z" fill="#fff"/>
    <circle cx="25" cy="30" r="2.4" fill="#0a0a0b"/><circle cx="39" cy="30" r="2.4" fill="#0a0a0b"/>
    <path d="M28 38c2 2 6 2 8 0" stroke="#0a0a0b" stroke-width="2" stroke-linecap="round"/>
  </svg>`;

  // ---------- Promo banner ----------
  const bannerEl = document.querySelector("[data-banner]");
  if (bannerEl) {
    bannerEl.innerHTML = `<div class="promo-banner" id="promoBanner">
      Apex Trader Funding is 80% Off With Code:
      <span class="code-pill" data-copy="${CODE}">${CODE} <span aria-hidden="true">⧉</span></span>
      <button class="close-banner" aria-label="Close">&times;</button>
    </div>`;
    bannerEl.querySelector(".close-banner").addEventListener("click", () => {
      document.getElementById("promoBanner").remove();
    });
  }

  // ---------- Header ----------
  const headerEl = document.querySelector("[data-header]");
  if (headerEl) {
    headerEl.innerHTML = `
    <header class="site-header">
      <div class="container nav">
        <a class="nav-brand" href="index.html">${BULL} ${CFG.brandName || "SY TRADES"}</a>
        <div class="nav-right">
          <span class="nav-links-label">My Links</span>
          <button class="menu-btn" id="menuBtn" aria-label="Menu"><span></span><span></span><span></span></button>
        </div>
      </div>
      <div class="menu-dropdown" id="menuDropdown">
        <a href="${INVITE}" target="_blank" rel="noopener"><span class="ico">💬</span> Join Free Discord</a>
        <a href="giveaway.html"><span class="ico">🎉</span> Enter Giveaway</a>
        <a href="compare.html">Compare Firms</a>
        <a href="true-cost.html">True Cost to Funding</a>
        <a href="beginner-guide.html">A-Z Beginner Guide</a>
        <a href="maximizing-payouts.html">Maximizing Payouts</a>
        <a href="${INVITE}" target="_blank" rel="noopener">Sy Trades Community</a>
      </div>`;
    const btn = document.getElementById("menuBtn");
    const dd = document.getElementById("menuDropdown");
    btn.addEventListener("click", (e) => { e.stopPropagation(); dd.classList.toggle("open"); });
    document.addEventListener("click", (e) => {
      if (!dd.contains(e.target) && e.target !== btn) dd.classList.remove("open");
    });
  }

  // ---------- Footer ----------
  const footerEl = document.querySelector("[data-footer]");
  if (footerEl) {
    footerEl.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-disclaimer">
          <h4>Disclaimer — Sy Trades</h4>
          <div><span style="color:var(--text-dim);font-size:13px;font-weight:600;">Link to SEC's Disclaimer:</span><br>
            <a class="sec-link" href="https://www.sec.gov/investor/pubs/daytips.htm" target="_blank" rel="noopener">THINKING OF DAY TRADING? KNOW THE RISKS.</a>
          </div>
          <p>We do not provide financial advice, only education. Signals are solely for educational purposes, and we are not responsible for losses incurred.</p>
          <p>We do not trade other people's funds, nor do we manage anybody's money. Your information will not be shared anywhere. Our Discord community is completely free to join and participate in.</p>
          <p>All educational content, giveaways, and community features are provided at no cost. There are no subscription fees or hidden charges for accessing our Discord server and educational resources.</p>
        </div>
        <div class="footer-cols">
          <div>
            <h5>Firms</h5>
            <a href="https://apextraderfunding.com" target="_blank" rel="noopener">Apex Trader Funding</a>
            <a href="https://lucidtrading.com" target="_blank" rel="noopener">Lucid Trading</a>
            <a href="https://tradeify.co" target="_blank" rel="noopener">Tradeify</a>
            <a href="https://thealphafutures.com" target="_blank" rel="noopener">Alpha Futures</a>
            <a href="https://takeprofittrader.com" target="_blank" rel="noopener">Take Profit Trader</a>
          </div>
          <div>
            <h5>Support</h5>
            <a href="terms.html">Privacy / Terms</a>
            <a href="index.html#about">About Us</a>
          </div>
          <div>
            <h5>Prop Firm Info</h5>
            <a href="compare.html">Prop Firm Comparison</a>
            <a href="true-cost.html">True Cost to Funding</a>
            <a href="maximizing-payouts.html">Maximizing Payouts</a>
          </div>
          <div>
            <h5>Socials</h5>
            <a href="${S.youtube||'#'}" target="_blank" rel="noopener">YouTube</a>
            <a href="${S.twitter||'#'}" target="_blank" rel="noopener">X / Twitter</a>
            <a href="${S.instagram||'#'}" target="_blank" rel="noopener">Instagram</a>
            <a href="${S.discord||INVITE}" target="_blank" rel="noopener">Discord</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span class="back-top" onclick="window.scrollTo({top:0,behavior:'smooth'})">Back to Top</span>
          <div class="footer-logo">${BULL}</div>
          © ${new Date().getFullYear()} Sy Trades. All rights reserved.
        </div>
      </div>
    </footer>`;
  }

  // ---------- Copy-to-clipboard for any [data-copy] ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-copy]");
    if (!t) return;
    const val = t.getAttribute("data-copy");
    navigator.clipboard && navigator.clipboard.writeText(val).then(() => {
      const old = t.innerHTML;
      t.innerHTML = "Copied ✓";
      setTimeout(() => (t.innerHTML = old), 1200);
    });
  });

  // expose logo for other scripts
  window.SY_BULL = BULL;
})();
