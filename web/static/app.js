function fmt(n,d=2){return typeof n==="number"?n.toLocaleString("en-US",{maximumFractionDigits:d}):n}

async function loadLatest(){
  const rows = await fetch("/api/latest").then(r=>r.json());
  document.getElementById("root").textContent = JSON.stringify(rows.slice(-3), null, 2);
}

async function loadEquity(){
  const rows = await fetch("/api/equity").then(r=>r.json());
  const labels = rows.slice(-80).map(r=>r.t);
  const data   = rows.slice(-80).map(r=>r.equity);
  const yMin = 0;
  const yMax = Math.ceil(Math.max(...data) / 100) * 100 || 100;

  const ctx = document.getElementById("equityChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Equity ($)", data, tension: 0.25, fill: false, pointRadius: 0 }]},
    options: {
      responsive: false,
      animation: false,
      scales: { x: { ticks: { maxTicksLimit: 6 } }, y: { min: yMin, max: yMax, ticks: { stepSize: 100 } } },
      plugins: { legend: { display: true } }
    }
  });
}

async function loadMetrics(){
  const m = await fetch("/api/metrics").then(r=>r.json());
  const el = document.getElementById("metrics");
  el.innerHTML = `
    <div class="kpi"><div class="label">Samples</div><div class="value">${fmt(m.samples,0)}</div></div>
    <div class="kpi"><div class="label">Win%</div><div class="value">${fmt(m.winrate,2)}%</div></div>
    <div class="kpi"><div class="label">PF</div><div class="value">${fmt(m.pf,2)}</div></div>
    <div class="kpi"><div class="label">Sharpe</div><div class="value">${fmt(m.sharpe,2)}</div></div>
    <div class="kpi"><div class="label">Max DD</div><div class="value">${fmt(m.max_dd,2)}%</div></div>
  `;
}

loadLatest();
loadEquity();
loadMetrics();
