function fmt(n,d=2){return typeof n==="number"?n.toLocaleString("en-US",{maximumFractionDigits:d}):n}
let chart;

async function loadLatest(){
  const rows = await fetch("/api/latest").then(r=>r.json());
  document.getElementById("root").textContent = JSON.stringify(rows.slice(-3), null, 2);
}

async function loadEquity(days){
  const q = days ? `?days=${days}` : "";
  const rows = await fetch("/api/equity"+q).then(r=>r.json());
  const labels = rows.slice(-80).map(r=>r.t);
  const data   = rows.slice(-80).map(r=>r.equity);
  const yMin = 0;
  const yMax = Math.ceil(Math.max(...data) / 100) * 100 || 100;

  const ctx = document.getElementById("equityChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
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

async function loadMetrics(days){
  const q = days ? `?days=${days}` : "";
  const m = await fetch("/api/metrics"+q).then(r=>r.json());
  const el = document.getElementById("metrics");
  el.innerHTML = `
    <div class="kpi"><div class="label">Samples</div><div class="value">${fmt(m.samples,0)}</div></div>
    <div class="kpi"><div class="label">Win%</div><div class="value">${fmt(m.winrate,2)}%</div></div>
    <div class="kpi"><div class="label">PF</div><div class="value">${fmt(m.pf,2)}</div></div>
    <div class="kpi"><div class="label">Sharpe</div><div class="value">${fmt(m.sharpe,2)}</div></div>
    <div class="kpi"><div class="label">Max DD</div><div class="value">${fmt(m.max_dd,2)}%</div></div>`;
}

async function boot(){
  const sel = document.getElementById("range");
  const run = async ()=>{const v=sel.value||""; await loadEquity(v); await loadMetrics(v);};
  sel.addEventListener("change", run);
  await loadLatest();
  await run();
}
boot();
