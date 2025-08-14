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

function badge(val, label, state){
  const bg = state==="good"?"#e8f7ee":state==="warn"?"#fff7e6":state==="bad"?"#fdeaea":"#fafafa";
  const br = state==="good"?"#b7e3c7":state==="warn"?"#ffe1b3":state==="bad"?"#f7b9b9":"#eee";
  return `<div class="kpi" style="background:${bg};border-color:${br}"><div class="label">${label}</div><div class="value">${val}</div></div>`;
}

async function loadMetrics(days){
  const q = days ? `?days=${days}` : "";
  const m = await fetch("/api/metrics"+q).then(r=>r.json());
  const pfState = m.pf>1 ? "good" : "bad";
  const winState = m.winrate>=50 ? "good" : "warn";
  const ddState = m.max_dd<=-10 ? "bad" : "good";
  const shState = m.sharpe>=1 ? "good" : "warn";
  const el = document.getElementById("metrics");
  el.innerHTML =
    badge(fmt(m.samples,0),"Samples","")+
    badge(fmt(m.winrate,2)+"%","Win%",winState)+
    badge(fmt(m.pf,2),"PF",pfState)+
    badge(fmt(m.sharpe,2),"Sharpe",shState)+
    badge(fmt(m.max_dd,2)+"%","Max DD",ddState);
}

async function boot(){
  const sel = document.getElementById("range");
  const run = async ()=>{const v=sel.value||""; await loadEquity(v); await loadMetrics(v);};
  sel.addEventListener("change", run);
  await loadLatest();
  await run();
}
boot();
