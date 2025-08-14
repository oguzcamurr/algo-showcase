fetch("/api/latest").then(r=>r.json()).then(rows=>{
  document.getElementById("root").innerHTML =
    "<pre>"+JSON.stringify(rows.slice(-10), null, 2)+"</pre>";
});
