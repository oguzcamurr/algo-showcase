function fmt(n,d=2){return typeof n==="number"?n.toLocaleString("en-US",{maximumFractionDigits:d}):n}
let chart;
const $ = s => document.querySelector(s);
function show(el,on){ el.style.display = on ? "block":"none"; }
function showErr(msg){ const el=$("#err"); el.textContent=msg||""; show(el, !!msg); }
async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(`${url} -> ${r.status}`); return await r.json(); }

async function loadLatest(){
  try{ const rows = await getJSON("/api/latest"); $("#root").textContent = JSON.stringify(rows.slice(-3), null, 2); }
  catch(e){ $("#root").textContent = "Failed to load /api/latest"; }
}

function drawChart(labels, data){
  const ctx = $("#equityChart").getContext("2d");
  if(chart) chart.destroy();
  const yMin = 0;
  const maxVal = data.length ? Math.max(...data) : 100;
  const yMax = Math.ceil(maxVal/100)*100 || 100;
  chart = new Chart(ctx,{
    type:"line",
    data:{labels, datasets:[{label:"Equity ($)", data, tension:0.25, fill:false, pointRadius:0}]},
    options:{ responsive:false, animation:false, scales:{ x:{ticks:{maxTicksLimit:6}}, y:{min:yMin,max:yMax,ticks:{stepSize:100}} }, plugins:{legend:{display:true}} }
  });
}

function renderTrades(rows){
  if(!rows.length){ $("#trades").innerHTML = "<div class='muted'>No trades</div>"; return; }
  const head = "<tr><th>Time</th><th>Side</th><th>Entry</th><th>Exit</th><th>Ret%</th><th>PnL $</th></tr>";
  const body = rows.map(r=>{
    const cls = r.pnl_usd>=0 ? "pos":"neg";
    return `<tr><td>${r.time}</td><td>${r.direction}</td><td>${fmt(r.entry,4)}</td><td>${fmt(r.exit,4)}</td><td>${fmt(r.ret_pct,2)}</td><td class='${cls}'>${fmt(r.pnl_usd,2)}</td></tr>`;
  }).join("");
  $("#trades").innerHTML = `<table>${head}${body}</table>`;
}

async function loadEquityMetricsTrades(){
  showErr("");
  const sel = $("#range").value;
  const eqSpin=$("#equitySpin"), mtSpin=$("#metricsSpin"), trSpin=$("#tradesSpin");
  show(eqSpin,true); show(mtSpin,true); show(trSpin,true);

  let q = "";
  if(sel==="custom"){
    const s=$("#startDate").value, e=$("#endDate").value;
    if(!(s&&e)){ show(eqSpin,false); show(mtSpin,false); show(trSpin,false); return; }
    q = `?start=${s}&end=${e}`;
  }else if(sel){
    q = `?days=${parseInt(sel,10)}`;
  }

  try{
    const [rows, m, t] = await Promise.all([
      getJSON("/api/equity"+q),
      getJSON("/api/metrics"+q),
      getJSON("/api/trades"+q+"&limit=50")
    ]);
    const labels = rows.map(r=>r.t);
    const data   = rows.map(r=>r.equity);
    if(labels.length===0) showErr("No data for selected range.");
    drawChart(labels, data);

    const pfState = m.pf>1 ? "good" : "bad";
    const winState = m.winrate>=50 ? "good" : "warn";
    const ddState = m.max_dd<=-10 ? "bad" : "good";
    const shState = m.sharpe>=1 ? "good" : "warn";
    const card = (val,label,state)=>{
      const bg = state==="good"?"#e8f7ee":state==="warn"?"#fff7e6":state==="bad"?"#fdeaea":"#fafafa";
      const br = state==="good"?"#b7e3c7":state==="warn"?"#ffe1b3":state==="bad"?"#f7b9b9":"#eee";
      return `<div class="kpi" style="background:${bg};border-color:${br}"><div class="label">${label}</div><div class="value">${val}</div></div>`;
    };
    $("#metrics").innerHTML =
      card(fmt(m.samples,0),"Samples","")+
      card(fmt(m.winrate,2)+"%","Win%",winState)+
      card(fmt(m.pf,2),"PF",pfState)+
      card(fmt(m.sharpe,2),"Sharpe",shState)+
      card(fmt(m.max_dd,2)+"%","Max DD",ddState);

    renderTrades(t);
  }catch(e){
    showErr("Backend error: "+e.message);
  }finally{
    show(eqSpin,false); show(mtSpin,false); show(trSpin,false);
  }
}

function bindUI(){
  const sel=$("#range");
  const custom=$("#customRange");
  const toggle=()=>{
    const isCustom = sel.value==="custom";
    custom.style.display = isCustom ? "flex":"none";
    if(!isCustom) loadEquityMetricsTrades();
  };
  sel.addEventListener("change",toggle);
  $("#startDate").addEventListener("change",loadEquityMetricsTrades);
  $("#endDate").addEventListener("change",loadEquityMetricsTrades);
  toggle();
}

async function boot(){
  await loadLatest();
  bindUI();
  await loadEquityMetricsTrades();
}
boot();
