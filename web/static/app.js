async function loadLatest(){
  const rows = await fetch("/api/latest").then(r=>r.json());
  document.getElementById("root").innerHTML =
    "<pre>"+JSON.stringify(rows.slice(-3), null, 2)+"</pre>";
}

async function loadEquity(){
  let rows = await fetch("/api/equity").then(r=>r.json());
  rows = rows.slice(-80);

  const labels = rows.map(r=>r.t);
  const data   = rows.map(r=>r.equity);

  const yMin = 0;
  const yMax = Math.ceil(Math.max(...data) / 100) * 100 || 100;

  const ctx = document.getElementById("equityChart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Equity ($)", data, tension: 0.25, fill: false, pointRadius: 0 }]},
    options: {
      responsive: false,             // << kilit: artık boyut değişmez
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 6 } },
        y: { min: yMin, max: yMax, ticks: { stepSize: 100 } }
      },
      plugins: { legend: { display: true } }
    }
  });
}

loadLatest();
loadEquity();
