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

/* === Trades state (filter + sort) === */
let TRADES_ALL = [];
let TRADES_VIEW = [];
let sortKey = "time";
let sortDir = "desc";
let sideFilter = "ALL";

// dynamic ranges
let bounds = {
  ret: {min: 0, max: 0},
  pnl: {min: 0, max: 0}
};
let filters = {
  retMin: null, retMax: null,
  pnlMin: null, pnlMax: null
};

const KEY_TYPES = {
  time: "str",
  direction: "str",
  entry: "num",
  exit: "num",
  ret_pct: "num",
  pnl_usd: "num",
};

function clamp(v,lo,hi){ return Math.max(lo, Math.min(hi, v)); }

function setBoundsFromData(){
  if(!TRADES_ALL.length){
    show($("#rangeFilters"), false);
    return;
  }
  const rets = TRADES_ALL.map(r=>Number(r.ret_pct)).filter(n=>!Number.isNaN(n));
  const pnls = TRADES_ALL.map(r=>Number(r.pnl_usd)).filter(n=>!Number.isNaN(n));
  const rmin = Math.min(...rets), rmax = Math.max(...rets);
  const pmin = Math.min(...pnls), pmax = Math.max(...pnls);

  // tiny padding for nicer UX
  const pad = (x)=> Math.abs(x)*0.02;
  bounds.ret.min = Math.floor((rmin - pad(rmin)) * 100)/100;
  bounds.ret.max = Math.ceil((rmax + pad(rmax)) * 100)/100;
  bounds.pnl.min = Math.floor((pmin - pad(pmin)) * 100)/100;
  bounds.pnl.max = Math.ceil((pmax + pad(pmax)) * 100)/100;

  // default filters = full range
  filters.retMin = bounds.ret.min;
  filters.retMax = bounds.ret.max;
  filters.pnlMin = bounds.pnl.min;
  filters.pnlMax = bounds.pnl.max;

  // init sliders
  const retMinEl = $("#retMin"), retMaxEl = $("#retMax");
  const pnlMinEl = $("#pnlMin"), pnlMaxEl = $("#pnlMax");

  [retMinEl, retMaxEl].forEach(el=>{
    el.min = bounds.ret.min; el.max = bounds.ret.max; el.step = "0.01";
  });
  [pnlMinEl, pnlMaxEl].forEach(el=>{
    el.min = bounds.pnl.min; el.max = bounds.pnl.max; el.step = "0.01";
  });

  retMinEl.value = filters.retMin;
  retMaxEl.value = filters.retMax;
  pnlMinEl.value = filters.pnlMin;
  pnlMaxEl.value = filters.pnlMax;

  updateRangeReadouts();
  show($("#rangeFilters"), true);
}

function updateRangeReadouts(){
  $("#retReadout").textContent = `${Number(filters.retMin).toFixed(2)}% → ${Number(filters.retMax).toFixed(2)}%`;
  $("#pnlReadout").textContent = `$${Number(filters.pnlMin).toFixed(2)} → $${Number(filters.pnlMax).toFixed(2)}`;

  const isDefault = (
    filters.retMin===bounds.ret.min &&
    filters.retMax===bounds.ret.max &&
    filters.pnlMin===bounds.pnl.min &&
    filters.pnlMax===bounds.pnl.max &&
    sideFilter==="ALL"
  );
  const chip = $("#activeFilters");
  if(isDefault){ show(chip,false); chip.textContent=""; }
  else{
    chip.textContent = `Side:${sideFilter} • Ret%:${filters.retMin}→${filters.retMax} • PnL:${filters.pnlMin}→${filters.pnlMax}`;
    show(chip,true);
  }
}

function enforceMinMaxCouple(aEl,bEl,isRet){
  // keep min <= max by swapping if needed
  const minVal = Number(aEl.value), maxVal = Number(bEl.value);
  if(minVal > maxVal){
    // swap
    const tmp = aEl.value;
    aEl.value = bEl.value;
    bEl.value = tmp;
  }
  if(isRet){
    filters.retMin = Number($("#retMin").value);
    filters.retMax = Number($("#retMax").value);
  }else{
    filters.pnlMin = Number($("#pnlMin").value);
    filters.pnlMax = Number($("#pnlMax").value);
  }
  updateRangeReadouts();
  applyFiltersAndSort();
}

let sliderDebounce;
function onSliderChange(){
  clearTimeout(sliderDebounce);
  sliderDebounce = setTimeout(()=>{
    enforceMinMaxCouple($("#retMin"), $("#retMax"), true);
    enforceMinMaxCouple($("#pnlMin"), $("#pnlMax"), false);
  }, 80);
}

function resetFilters(){
  sideFilter = "ALL";
  filters.retMin = bounds.ret.min;
  filters.retMax = bounds.ret.max;
  filters.pnlMin = bounds.pnl.min;
  filters.pnlMax = bounds.pnl.max;

  $("#sideFilter").value = "ALL";
  $("#retMin").value = filters.retMin;
  $("#retMax").value = filters.retMax;
  $("#pnlMin").value = filters.pnlMin;
  $("#pnlMax").value = filters.pnlMax;
  updateRangeReadouts();
  applyFiltersAndSort();
}

function applyFiltersAndSort(){
  TRADES_VIEW = TRADES_ALL.filter(r => {
    const sideOk = (sideFilter==="ALL") ? true : String(r.direction).toUpperCase()===sideFilter;
    const ret = Number(r.ret_pct), pnl = Number(r.pnl_usd);
    const retOk = ret >= filters.retMin && ret <= filters.retMax;
    const pnlOk = pnl >= filters.pnlMin && pnl <= filters.pnlMax;
    return sideOk && retOk && pnlOk;
  });

  const t = KEY_TYPES[sortKey] || "str";
  TRADES_VIEW.sort((a,b)=>{
    let va = a[sortKey], vb = b[sortKey];
    if(t === "num"){ va = Number(va); vb = Number(vb); }
    else { va = String(va); vb = String(vb); }
    if(va < vb) return sortDir==="asc" ? -1 : 1;
    if(va > vb) return sortDir==="asc" ? 1 : -1;
    return 0;
  });

  renderTrades(TRADES_VIEW);
}

function headerCell(label, key){
  const arrow = sortKey===key ? (sortDir==="asc" ? "▲" : "▼") : "";
  return `<th class="sortable" data-key="${key}">${label}<span class="arrow">${arrow}</span></th>`;
}

function renderTrades(rows){
  if(!rows.length){ $("#trades").innerHTML = "<div class='muted'>No trades</div>"; return; }

  const thead =
    `<thead><tr>`+
    headerCell("Time","time")+
    headerCell("Side","direction")+
    headerCell("Entry","entry")+
    headerCell("Exit","exit")+
    headerCell("Ret%","ret_pct")+
    headerCell("PnL $","pnl_usd")+
    `</tr></thead>`;

  const tbody = "<tbody>"+ rows.map(r=>{
    const cls = r.pnl_usd>=0 ? "pos":"neg";
    return `<tr>
      <td>${r.time}</td>
      <td>${r.direction}</td>
      <td>${fmt(r.entry,4)}</td>
      <td>${fmt(r.exit,4)}</td>
      <td>${fmt(r.ret_pct,2)}</td>
      <td class='${cls}'>${fmt(r.pnl_usd,2)}</td>
    </tr>`;
  }).join("") + "</tbody>";

  $("#trades").innerHTML = `<table>${thead}${tbody}</table>`;

  $("#trades").querySelectorAll("th.sortable").forEach(th=>{
    th.addEventListener("click", ()=>{
      const key = th.getAttribute("data-key");
      if(key === sortKey){
        sortDir = (sortDir==="asc") ? "desc" : "asc";
      }else{
        sortKey = key;
        sortDir = (KEY_TYPES[key]==="num") ? "desc" : "asc";
      }
      applyFiltersAndSort();
    });
  });
}

/* === CSV Export === */
function toCSV(rows){
  const cols = ["time","direction","entry","exit","ret_pct","pnl_usd"];
  const header = cols.join(",");
  const esc = v => {
    if(v==null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(","));
  return [header, ...lines].join("\r\n");
}

function downloadCSV(){
  const rows = TRADES_VIEW.length ? TRADES_VIEW : TRADES_ALL;
  if(!rows.length){ alert("No trades to export."); return; }
  const side = sideFilter.toLowerCase();
  const now = new Date();
  const pad = n => String(n).padStart(2,"0");
  const fname = `trades_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}_${side}.csv`;

  const csv = toCSV(rows);
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

    TRADES_ALL = Array.isArray(t) ? t.slice() : [];
    setBoundsFromData();
    applyFiltersAndSort();
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

  $("#sideFilter").addEventListener("change", (e)=>{
    sideFilter = e.target.value;
    updateRangeReadouts();
    applyFiltersAndSort();
  });
  const sliders = ["retMin","retMax","pnlMin","pnlMax"].map(id=>$("#"+id));
  sliders.forEach(el=>{
    el.addEventListener("input", onSliderChange);
    el.addEventListener("change", onSliderChange);
  });
  const btn = $("#btnCsv");
  if(btn) btn.addEventListener("click", downloadCSV);
  const btnReset = $("#btnReset");
  if(btnReset) btnReset.addEventListener("click", resetFilters);

  toggle();
}

async function boot(){
  await loadLatest();
  bindUI();
  await loadEquityMetricsTrades();
}
boot();
