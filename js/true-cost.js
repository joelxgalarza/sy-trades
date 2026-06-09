/* True Cost to Funding calculator */
(function () {
  const D = window.SY_DATA;
  const CODE = D.code;
  let active = "50K";

  const sel = document.getElementById("sizeSelector");
  const rows = document.getElementById("costRows");

  sel.innerHTML = D.sizeOrder.map(s =>
    `<button class="size-btn ${s===active?'active':''}" data-size="${s}">$${s}</button>`).join("");

  function fmt(n) { return "$" + n.toLocaleString(); }

  function renderRows() {
    const data = D.trueCost[active] || [];
    rows.innerHTML = data.map(([key, evalCost, activation]) => {
      const f = D.firms[key];
      const off = D.discounts[key];
      const total = evalCost + activation;
      return `<div class="cost-row">
        <div class="cost-firm">
          <div class="cf-logo">${f.logo}</div>
          <span>${f.name}</span>
        </div>
        <div class="cost-col"><div class="label">${active} Eval Cost</div><div class="val">${fmt(evalCost)}</div></div>
        <div class="cost-col"><div class="label">Activation Fee</div><div class="val">${fmt(activation)}</div></div>
        <div class="cost-col"><div class="label">True Cost to Funding</div><div class="val blue">${fmt(total)}</div></div>
        <div class="code-box">
          <span class="lbl">Code:</span><span class="code">${CODE}</span>
          <span class="copy" data-copy="${CODE}">⧉</span>
          <span class="off">${off}% OFF</span>
        </div>
        <a class="btn btn-sm" href="${f.site}" target="_blank" rel="noopener">Learn More ↗</a>
      </div>`;
    }).join("");
  }

  sel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-size]");
    if (!b) return;
    active = b.getAttribute("data-size");
    sel.querySelectorAll(".size-btn").forEach(x => x.classList.toggle("active", x === b));
    renderRows();
  });

  renderRows();
})();
