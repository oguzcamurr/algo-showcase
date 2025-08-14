function fmt(n,d=2){return typeof n==="number"?n.toLocaleString("en-US",{maximumFractionDigits:d}):n}
let chart;
const $ = s => document.querySelector(s);

function showErr(msg){
  const el=$("#err");
  el.textContent=msg||"";
  el.style.display = msg ? "block":"none";
}

async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(`${url} -> ${r.status}`);
  return await r.json();
}

async function loadLatest(){
  try{
    const rows = await getJSON("/api/latest");
    $("#root").textContent = JSON.stringify(rows.slice(-3), null, 2);
  }catch(e){
    console.error(e);
    $("#root").textContent = "Failed to load /api/latest";
  }
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
    options:{
      responsive:false, animation:false,
      scales:{ x:{ticks:{maxTicksLimit:6}}, y:{min:yMin,max:yMax,ticks:{stepSize:100}} },
      plugins:{legend:{display:true}}
    }
  });
}

async function loadEquityAndMetrics(){
  showErr("");
  const sel = $("#range").value;
  let equityURL = "/api/equity";
  let metricsURL = "/api/metrics";

  if(sel==="custom"){
    const s=$("#startDate").value, e=$("#endDate").value;
    if(!(s&&e)) return; // tarih seçilmeden yükleme
    equityURL += `?start=${s}&end=${e}`;
    metricsURL += `?start=${s}&end=${e}`;
  }else if(sel){
    equityURL += `?days=${parseInt(sel,10)}`;
    metricsURL += `?days=${parseInt(sel,10)}`;
  }

  try{
    const [rows, m] = await Promise.all([ getJSON(equityURL), getJSON(metricsURL) ]);

    const labels = rows.map(r=>r.t);
    const data   = rows.map(r=>r.equity);
    if(labels.length===0){
      showErr("No data for selected range.");
    }
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

  }catch(e){
    console.error(e);
    showErr("Backend error: "+e.message);
  }
}

function bindUI(){
  const sel=$("#range");
  const custom=$("#customRange");
  const toggle=()=>{
    const isCustom = sel.value==="custom";
    custom.style.display = isCustom ? "flex":"none";
    if(!isCustom) loadEquityAndMetrics();
  };
  sel.addEventListener("change",toggle);
  $("#startDate").addEventListener("change",loadEquityAndMetrics);
  $("#endDate").addEventListener("change",loadEquityAndMetrics);
  toggle();
}

async function boot(){
  bindUI();
  await loadLatest();
  await loadEquityAndMetrics();
}
boot();
