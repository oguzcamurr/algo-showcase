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
let resultFilter = "ALL"; // ALL | WIN | LOSS

// data bounds & live filters
let bounds = { ret: {min: 0, max: 0}, pnl: {min: 0, max: 0} };
let filters = { retMin: null, retMax: null, pnlMin: null, pnlMax: null };

const KEY_TYPES = { time:"str", direction:"str", entry:"num", exit:"num", ret_pct:"num", pnl_usd:"num" };
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

function setActiveSeg(id){ ["resAll","resWin","resLoss"].forEach(x=>$("#"+x)?.classList.toggle("active", x===id)); }

function enforceResultLock(){
  const retMinEl=$("#retMin"), retMaxEl=$("#retMax"), pnlMinEl=$("#pnlMin"), pnlMaxEl=$("#pnlMax");
  let retMinAllowed=bounds.ret.min, retMaxAllowed=bounds.ret.max;
  let pnlMinAllowed=bounds.pnl.min, pnlMaxAllowed=bounds.pnl.max;

  if(resultFilter==="WIN"){ retMinAllowed=Math.max(0,retMinAllowed); pnlMinAllowed=Math.max(0,pnlMinAllowed); }
  else if(resultFilter==="LOSS"){ retMaxAllowed=Math.min(0,retMaxAllowed); pnlMaxAllowed=Math.min(0,pnlMaxAllowed); }

  retMinEl.min=retMinAllowed; retMinEl.max=retMaxAllowed;
  retMaxEl.min=retMinAllowed; retMaxEl.max=retMaxAllowed;
  pnlMinEl.min=pnlMinAllowed; pnlMinEl.max=pnlMaxAllowed;
  pnlMaxEl.min=pnlMinAllowed; pnlMaxEl.max=pnlMaxAllowed;

  filters.retMin = clamp(filters.retMin, retMinAllowed, retMaxAllowed);
  filters.retMax = clamp(filters.retMax, retMinAllowed, retMaxAllowed);
  filters.pnlMin = clamp(filters.pnlMin, pnlMinAllowed, pnlMaxAllowed);
  filters.pnlMax = clamp(filters.pnlMax, pnlMinAllowed, pnlMaxAllowed);

  if(filters.retMin>filters.retMax){ [filters.retMin,filters.retMax]=[filters.retMax,filters.retMin]; }
  if(filters.pnlMin>filters.pnlMax){ [filters.pnlMin,filters.pnlMax]=[filters.pnlMax,filters.pnlMin]; }

  retMinEl.value=filters.retMin; retMaxEl.value=filters.retMax;
  pnlMinEl.value=filters.pnlMin; pnlMaxEl.value=filters.pnlMax;
}

function setBoundsFromData(){
  if(!TRADES_ALL.length){ show($("#rangeFilters"),false); return; }
  const rets=TRADES_ALL.map(r=>+r.ret_pct).filter(n=>!Number.isNaN(n));
  const pnls=TRADES_ALL.map(r=>+r.pnl_usd).filter(n=>!Number.isNaN(n));
  const rmin=Math.min(...rets), rmax=Math.max(...rets);
  const pmin=Math.min(...pnls), pmax=Math.max(...pnls);
  const pad=x=>Math.abs(x)*0.02;

  bounds.ret.min=Math.floor((rmin-pad(rmin))*100)/100;
  bounds.ret.max=Math.ceil((rmax+pad(rmax))*100)/100;
  bounds.pnl.min=Math.floor((pmin-pad(pmin))*100)/100;
  bounds.pnl.max=Math.ceil((pmax+pad(pmax))*100)/100;

  filters.retMin=bounds.ret.min; filters.retMax=bounds.ret.max;
  filters.pnlMin=bounds.pnl.min; filters.pnlMax=bounds.pnl.max;

  const retMinEl=$("#retMin"), retMaxEl=$("#retMax"), pnlMinEl=$("#pnlMin"), pnlMaxEl=$("#pnlMax");
  [retMinEl,retMaxEl].forEach(el=>{ el.min=bounds.ret.min; el.max=bounds.ret.max; el.step="0.01"; });
  [pnlMinEl,pnlMaxEl].forEach(el=>{ el.min=bounds.pnl.min; el.max=bounds.pnl.max; el.step="0.01"; });
  retMinEl.value=filters.retMin; retMaxEl.value=filters.retMax;
  pnlMinEl.value=filters.pnlMin; pnlMaxEl.value=filters.pnlMax;

  enforceResultLock();
  updateRangeReadouts();
  show($("#rangeFilters"),true);
}

function updateRangeReadouts(){
  $("#retReadout").textContent = `${(+filters.retMin).toFixed(2)}% → ${(+filters.retMax).toFixed(2)}%`;
  $("#pnlReadout").textContent = `$${(+filters.pnlMin).toFixed(2)} → $${(+filters.pnlMax).toFixed(2)}`;
  const isDefault =
    sideFilter==="ALL" && resultFilter==="ALL" &&
    filters.retMin===bounds.ret.min && filters.retMax===bounds.ret.max &&
    filters.pnlMin===bounds.pnl.min && filters.pnlMax===bounds.pnl.max;
  const chip=$("#activeFilters");
  if(isDefault){ show(chip,false); chip.textContent=""; }
  else{
    const resTxt=(resultFilter==="WIN"?"Winners":(resultFilter==="LOSS"?"Losers":"All"));
    chip.textContent=`Side:${sideFilter} • Result:${resTxt} • Ret%:${filters.retMin}→${filters.retMax} • PnL:${filters.pnlMin}→${filters.pnlMax}`;
    show(chip,true);
  }
}

function enforceMinMaxCouple(aEl,bEl,isRet){
  if(+aEl.value>+bEl.value){ [aEl.value,bEl.value]=[bEl.value,aEl.value]; }
  if(isRet){ filters.retMin=+$("#retMin").value; filters.retMax=+$("#retMax").value; }
  else    { filters.pnlMin=+$("#pnlMin").value; filters.pnlMax=+$("#pnlMax").value; }
  enforceResultLock();
  updateRangeReadouts();
  applyFiltersAndSort();
}

let sliderDebounce;
function onSliderChange(){
  clearTimeout(sliderDebounce);
  sliderDebounce=setTimeout(()=>{
    enforceMinMaxCouple($("#retMin"),$("#retMax"),true);
    enforceMinMaxCouple($("#pnlMin"),$("#pnlMax"),false);
  },80);
}

function resetFilters(){
  sideFilter="ALL"; resultFilter="ALL"; setActiveSeg("resAll");
  filters.retMin=bounds.ret.min; filters.retMax=bounds.ret.max;
  filters.pnlMin=bounds.pnl.min; filters.pnlMax=bounds.pnl.max;
  $("#sideFilter").value="ALL";
  $("#retMin").value=filters.retMin; $("#retMax").value=filters.retMax;
  $("#pnlMin").value=filters.pnlMin; $("#pnlMax").value=filters.pnlMax;
  enforceResultLock(); updateRangeReadouts(); applyFiltersAndSort();
}

function applyFiltersAndSort(){
  TRADES_VIEW = TRADES_ALL.filter(r=>{
    const sideOk = sideFilter==="ALL" ? true : String(r.direction).toUpperCase()===sideFilter;
    const ret=+r.ret_pct, pnl=+r.pnl_usd;
    const retOk = ret>=filters.retMin && ret<=filters.retMax;
    const pnlOk = pnl>=filters.pnlMin && pnl<=filters.pnlMax;
    const resOk = resultFilter==="ALL" ? true : (resultFilter==="WIN" ? pnl>0 : pnl<0);
    return sideOk && retOk && pnlOk && resOk;
  });

  const t=KEY_TYPES[sortKey]||"str";
  TRADES_VIEW.sort((a,b)=>{
    let va=a[sortKey], vb=b[sortKey];
    if(t==="num"){ va=+va; vb=+vb; } else { va=String(va); vb=String(vb); }
    if(va<vb) return sortDir==="asc"?-1:1;
    if(va>vb) return sortDir==="asc"? 1:-1;
    return 0;
  });
  renderTrades(TRADES_VIEW);
}

function headerCell(label,key){
  const arrow = sortKey===key ? (sortDir==="asc"?"▲":"▼") : "";
  return `<th class="sortable" data-key="${key}">${label}<span class="arrow">${arrow}</span></th>`;
}

function renderTrades(rows){
  if(!rows.length){ $("#trades").innerHTML="<div class='muted'>No trades</div>"; return; }
  const thead=`<thead><tr>${
    headerCell("Time","time")+
    headerCell("Side","direction")+
    headerCell("Entry","entry")+
    headerCell("Exit","exit")+
    headerCell("Ret%","ret_pct")+
    headerCell("PnL $","pnl_usd")
  }</tr></thead>`;
  const tbody="<tbody>"+rows.map(r=>{
    const cls = r.pnl_usd>=0 ? "pos":"neg";
    return `<tr>
      <td>${r.time}</td>
      <td>${r.direction}</td>
      <td>${fmt(r.entry,4)}</td>
      <td>${fmt(r.exit,4)}</td>
      <td>${fmt(r.ret_pct,2)}</td>
      <td class='${cls}'>${fmt(r.pnl_usd,2)}</td>
    </tr>`;
  }).join("")+"</tbody>";
  $("#trades").innerHTML=`<table>${thead}${tbody}</table>`;
  $("#trades").querySelectorAll("th.sortable").forEach(th=>{
    th.addEventListener("click", ()=>{
      const key=th.getAttribute("data-key");
      if(key===sortKey){ sortDir=(sortDir==="asc")?"desc":"asc"; }
      else{ sortKey=key; sortDir=(KEY_TYPES[key]==="num")?"desc":"asc"; }
      applyFiltersAndSort();
    });
  });
}

/* CSV */
function toCSV(rows){
  const cols=["time","direction","entry","exit","ret_pct","pnl_usd"];
  const esc=v=>v==null?"":(/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:String(v));
  return [cols.join(","), ...rows.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\r\n");
}
function downloadCSV(){
  const rows = TRADES_VIEW.length?TRADES_VIEW:TRADES_ALL;
  if(!rows.length){ alert("No trades to export."); return; }
  const res=resultFilter.toLowerCase(), side=sideFilter.toLowerCase();
  const n=new Date(), pad=x=>String(x).padStart(2,"0");
  const fname=`trades_${n.getFullYear()}${pad(n.getMonth()+1)}${pad(n.getDate())}_${pad(n.getHours())}${pad(n.getMinutes())}_${side}_${res}.csv`;
  const blob=new Blob(["\uFEFF"+toCSV(rows)],{type:"text/csv;charset=utf-8;"}), url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function loadEquityMetricsTrades(){
  showErr("");
  const sel=$("#range").value;
  const eqSpin=$("#equitySpin"), mtSpin=$("#metricsSpin"), trSpin=$("#tradesSpin");
  show(eqSpin,true); show(mtSpin,true); show(trSpin,true);

  let q="";
  if(sel==="custom"){
    const s=$("#startDate").value, e=$("#endDate").value;
    if(!(s&&e)){ show(eqSpin,false); show(mtSpin,false); show(trSpin,false); return; }
    q=`?start=${s}&end=${e}`;
  }else if(sel){ q=`?days=${parseInt(sel,10)}`; }

  try{
    const [rows,m,t]=await Promise.all([
      getJSON("/api/equity"+q),
      getJSON("/api/metrics"+q),
      getJSON("/api/trades"+q+"&limit=50")
    ]);
    const labels=rows.map(r=>r.t), data=rows.map(r=>r.equity);
    if(!labels.length) showErr("No data for selected range.");
    drawChart(labels,data);

    const pfState=m.pf>1?"good":"bad";
    const winState=m.winrate>=50?"good":"warn";
    const ddState=m.max_dd<=-10?"bad":"good";
    const shState=m.sharpe>=1?"good":"warn";
    const card=(val,label,state)=>{
      const bg=state==="good"?"#e8f7ee":state==="warn"?"#fff7e6":state==="bad"?"#fdeaea":"#fafafa";
      const br=state==="good"?"#b7e3c7":state==="warn"?"#ffe1b3":state==="bad"?"#f7b9b9":"#eee";
      return `<div class="kpi" style="background:${bg};border-color:${br}"><div class="label">${label}</div><div class="value">${val}</div></div>`;
    };
    $("#metrics").innerHTML=
      card(fmt(m.samples,0),"Samples","")+
      card(fmt(m.winrate,2)+"%","Win%",winState)+
      card(fmt(m.pf,2),"PF",pfState)+
      card(fmt(m.sharpe,2),"Sharpe",shState)+
      card(fmt(m.max_dd,2)+"%","Max DD",ddState);

    TRADES_ALL = Array.isArray(t)?t.slice():[];
    setBoundsFromData();
    applyFiltersAndSort();
  }catch(e){ showErr("Backend error: "+e.message);
  }finally{ show(eqSpin,false); show(mtSpin,false); show(trSpin,false); }
}

function bindUI(){
  const sel=$("#range"), custom=$("#customRange");
  const toggle=()=>{ const isCustom=sel.value==="custom"; custom.style.display=isCustom?"flex":"none"; if(!isCustom) loadEquityMetricsTrades(); };
  sel.addEventListener("change",toggle);
  $("#startDate").addEventListener("change",loadEquityMetricsTrades);
  $("#endDate").addEventListener("change",loadEquityMetricsTrades);

  $("#sideFilter").addEventListener("change", e=>{ sideFilter=e.target.value; updateRangeReadouts(); applyFiltersAndSort(); });

  $("#resAll").addEventListener("click", ()=>{ resultFilter="ALL"; setActiveSeg("resAll"); enforceResultLock(); updateRangeReadouts(); applyFiltersAndSort(); });
  $("#resWin").addEventListener("click", ()=>{ resultFilter="WIN"; setActiveSeg("resWin"); enforceResultLock(); updateRangeReadouts(); applyFiltersAndSort(); });
  $("#resLoss").addEventListener("click",()=>{ resultFilter="LOSS";setActiveSeg("resLoss"); enforceResultLock(); updateRangeReadouts(); applyFiltersAndSort(); });

  ["retMin","retMax","pnlMin","pnlMax"].forEach(id=>{
    const el=$("#"+id); el.addEventListener("input",onSliderChange); el.addEventListener("change",onSliderChange);
  });

  $("#btnCsv").addEventListener("click", downloadCSV);
  $("#btnReset").addEventListener("click", resetFilters);

  toggle();
}

async function boot(){ await loadLatest(); bindUI(); await loadEquityMetricsTrades(); }
boot();
