
"use strict";
/* ================================================================
   SECTION 1 — STORAGE LAYER
   Wraps localStorage with an in-memory fallback so the app never
   crashes when storage is blocked (private mode, file:// quirks).
   ================================================================ */
const Storage = (() => {
  const KEY = "benchTracker.v1";
  let mem = null;                       // in-memory fallback bucket
  let usable = true;
  try { const t="__t"; localStorage.setItem(t,t); localStorage.removeItem(t); }
  catch(e){ usable = false; }
  return {
    load(){
      try { return usable ? JSON.parse(localStorage.getItem(KEY)) : mem; }
      catch(e){ return mem; }
    },
    save(data){
      try { usable ? localStorage.setItem(KEY, JSON.stringify(data)) : (mem = data); }
      catch(e){ mem = data; }
    },
    theme(v){
      try {
        if(v===undefined) return usable ? localStorage.getItem("benchTracker.theme") : (mem&&mem.__theme);
        usable ? localStorage.setItem("benchTracker.theme", v) : (mem = Object.assign(mem||{}, {__theme:v}));
      } catch(e){}
    }
  };
})();

/* ================================================================
   SECTION 2 — STATE + DEMO SEED DATA
   ================================================================ */
const uid = (p="id") => p + "_" + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-3);
const CATEGORIES = ["Sales/Pre-sales","R&D","Training","Internal Tooling","Recruiting","Admin"];
const STATUSES = ["Available","Partially Allocated","Fully Allocated","On Leave"];

function seedData(){
  const p = [
    { id:"p1", name:"Ammatti Mies", role:"Data Engineer",   location:"Tampere",  status:"Partially Allocated", capacity:40, availableFrom:"2026-08-01" },
    { id:"p2", name:"Ammatti Nainen", role:"Solution Analyst", location:"Helsinki", status:"Available",         capacity:40, availableFrom:"2026-08-10" },
    { id:"p3", name:"Aku Ankka", role:"UX Designer",     location:"Turku",    status:"Fully Allocated",    capacity:40, availableFrom:"2026-08-05" },
    { id:"p4", name:"Roope Ankka", role:"Cloud Architect", location:"Oulu",     status:"Available",          capacity:38, availableFrom:"2026-08-18" },
    { id:"p5", name:"Hannu Hanhi",  role:"Business Analyst", location:"Tampere",  status:"On Leave",          capacity:40, availableFrom:"2026-09-01" },
    { id:"p6", name:"Ohjelmisto Kehittäjä",     role:"Full-stack Dev",  location:"Helsinki", status:"Partially Allocated",capacity:40, availableFrom:"2026-08-12" }
  ];
  const i = [
    { id:"i1", name:"Q4 Sales Enablement Kit", category:"Sales/Pre-sales", owner:"Mikael Korhonen", priority:"High", status:"In Progress", targetDate:"2026-10-15" },
    { id:"i2", name:"GenAI Chatbot Prototype",  category:"R&D",            owner:"Aino Virtanen",   priority:"High", status:"In Progress", targetDate:"2026-09-30" },
    { id:"i3", name:"Databricks Cert Program",  category:"Training",       owner:"Jonas Nieminen",  priority:"Med",  status:"Not Started", targetDate:"2026-11-01" },
    { id:"i4", name:"Internal Staffing Tool",   category:"Internal Tooling",owner:"Ravi Patel",     priority:"Med",  status:"On Hold",     targetDate:"2026-10-20" },
    { id:"i5", name:"Graduate Hiring Drive",    category:"Recruiting",     owner:"Sofia Lindberg",  priority:"Low",  status:"In Progress", targetDate:"2026-12-01" }
  ];
  const a = [
    { id:"a1", personId:"p1", initiativeId:"i2", hours:20, start:"2026-08-01", end:"2026-09-30" },
    { id:"a2", personId:"p1", initiativeId:"i4", hours:10, start:"2026-08-05", end:"2026-10-20" },
    { id:"a3", personId:"p3", initiativeId:"i5", hours:40, start:"2026-08-05", end:"2026-12-01" },
    { id:"a4", personId:"p6", initiativeId:"i1", hours:15, start:"2026-08-12", end:"2026-10-15" },
    { id:"a5", personId:"p6", initiativeId:"i2", hours:12, start:"2026-08-12", end:"2026-09-30" }
  ];
  return { people:p, initiatives:i, allocations:a };
}

let state = Storage.load();
if(!state || !state.people){ state = seedData(); Storage.save(state); }

function persist(){ Storage.save(state); }

/* ================================================================
   SECTION 3 — UTILITIES / DERIVED DATA
   ================================================================ */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s??"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate = d => d ? new Date(d+"T00:00").toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"}) : "—";

const personById = id => state.people.find(p=>p.id===id);
const initById   = id => state.initiatives.find(i=>i.id===id);

// Total allocated hours/week for a person (sum across their allocations)
function allocatedFor(personId){
  return state.allocations.filter(a=>a.personId===personId).reduce((s,a)=>s+(Number(a.hours)||0),0);
}
function utilization(person){
  const alloc = allocatedFor(person.id);
  const cap = Number(person.capacity)||0;
  return { alloc, cap, remaining: Math.max(0, cap-alloc), pct: cap>0 ? Math.round(alloc/cap*100) : 0 };
}

/* ================================================================
   SECTION 4 — TOASTS
   ================================================================ */
function toast(msg, type="ok"){
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition=".3s"; setTimeout(()=>el.remove(),300); }, 2600);
}

/* ================================================================
   SECTION 5 — RENDERING: DASHBOARD
   ================================================================ */
function renderDashboard(){
  const bench = state.people.filter(p=>p.status!=="Fully Allocated" && p.status!=="On Leave");
  const totalCap = state.people.reduce((s,p)=>s+(Number(p.capacity)||0),0);
  const totalAlloc = state.people.reduce((s,p)=>s+allocatedFor(p.id),0);
  const unalloc = state.people.reduce((s,p)=>{ const u=utilization(p); return s+u.remaining; },0);
  const activeInit = state.initiatives.filter(i=>i.status==="In Progress"||i.status==="Not Started").length;
  const util = totalCap>0 ? Math.round(totalAlloc/totalCap*100) : 0;

  const cards = [
    {label:"People on bench", value:bench.length, sub:`of ${state.people.length} total`, accent:true},
    {label:"Available hours / wk", value:unalloc, sub:"unallocated capacity"},
    {label:"Overall utilization", value:util+"%", sub:`${totalAlloc}h of ${totalCap}h`},
    {label:"Active initiatives", value:activeInit, sub:`of ${state.initiatives.length} total`},
    {label:"Total capacity", value:totalCap+"h", sub:"across all people"}
  ];
  $("#summaryCards").innerHTML = cards.map(c=>`
    <div class="card ${c.accent?'accent':''}">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
      <div class="sub">${c.sub}</div>
    </div>`).join("");

  drawCapacityChart();
  drawCategoryChart();
}

/* ---- Canvas: per-person allocated vs remaining (stacked bars) ---- */
function drawCapacityChart(){
  const cv = $("#capacityChart");
  const ppl = state.people;
  const dpr = window.devicePixelRatio||1;
  const cssW = cv.clientWidth || 800, cssH = 300;
  cv.width = cssW*dpr; cv.height = cssH*dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,cssW,cssH);
  const cs = getComputedStyle(document.body);
  const cPrimary = cs.getPropertyValue("--primary").trim();
  const cRed = cs.getPropertyValue("--red").trim();
  const cBorder = cs.getPropertyValue("--border").trim();
  const cDim = cs.getPropertyValue("--text-dim").trim();
  const cSurf2 = cs.getPropertyValue("--surface-2").trim();

  if(!ppl.length){ ctx.fillStyle=cDim; ctx.font="14px sans-serif"; ctx.fillText("No people to display.",20,40); return; }

  const padL=40, padR=16, padT=16, padB=54;
  const chartW = cssW-padL-padR, chartH = cssH-padT-padB;
  const maxVal = Math.max(...ppl.map(p=>{ const u=utilization(p); return Math.max(u.cap,u.alloc); }), 8);
  const yTicks = 4;

  // gridlines + Y labels
  ctx.strokeStyle=cBorder; ctx.fillStyle=cDim; ctx.font="11px sans-serif"; ctx.textAlign="right";
  for(let t=0;t<=yTicks;t++){
    const val = Math.round(maxVal*t/yTicks);
    const y = padT+chartH-(chartH*t/yTicks);
    ctx.globalAlpha=.5; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(cssW-padR,y); ctx.stroke(); ctx.globalAlpha=1;
    ctx.fillText(val, padL-6, y+3);
  }

  const bw = chartW/ppl.length;
  const barW = Math.min(46, bw*0.6);
  ctx.textAlign="center";
  ppl.forEach((p,idx)=>{
    const u = utilization(p);
    const x = padL + bw*idx + (bw-barW)/2;
    const scale = challH => chartH * (challH/maxVal);
    const allocH = scale(Math.min(u.alloc,u.cap));
    const overH  = scale(Math.max(0,u.alloc-u.cap));
    const remH   = scale(u.remaining);
    let y = padT+chartH;
    // remaining (bottom)
    if(remH>0){ ctx.fillStyle=cSurf2; ctx.strokeStyle=cBorder; y-=remH; ctx.fillRect(x,y,barW,remH); ctx.strokeRect(x,y,barW,remH); }
    // allocated (within capacity)
    ctx.fillStyle=cPrimary; y-=allocH; ctx.fillRect(x,y,barW,allocH);
    // over-allocation
    if(overH>0){ ctx.fillStyle=cRed; y-=overH; ctx.fillRect(x,y,barW,overH); }
    // x label
    ctx.fillStyle=cDim; ctx.font="10px sans-serif";
    const first = p.name.split(" ")[0];
    ctx.fillText(first, x+barW/2, padT+chartH+16);
    ctx.fillText(u.alloc+"/"+u.cap+"h", x+barW/2, padT+chartH+30);
  });
}

/* ---- Canvas: active initiatives by category (horizontal bars) ---- */
function drawCategoryChart(){
  const cv = $("#categoryChart");
  const dpr = window.devicePixelRatio||1;
  const cssW = cv.clientWidth||800, cssH=240;
  cv.width=cssW*dpr; cv.height=cssH*dpr;
  const ctx=cv.getContext("2d"); ctx.scale(dpr,dpr); ctx.clearRect(0,0,cssW,cssH);
  const cs=getComputedStyle(document.body);
  const cPrimary=cs.getPropertyValue("--primary").trim();
  const cDim=cs.getPropertyValue("--text-dim").trim();

  const counts = {};
  CATEGORIES.forEach(c=>counts[c]=0);
  state.initiatives.forEach(i=>{ if(counts[i.category]!==undefined) counts[i.category]++; });
  const entries = Object.entries(counts).filter(([,v])=>v>0);
  if(!entries.length){ ctx.fillStyle=cDim; ctx.font="14px sans-serif"; ctx.fillText("No initiatives yet.",20,40); return; }
  const max = Math.max(...entries.map(e=>e[1]),1);
  const padL=130, padR=40, padT=10;
  const rowH = Math.min(34,(cssH-padT*2)/entries.length);
  const barMax = cssW-padL-padR;
  entries.forEach(([cat,val],idx)=>{
    const y = padT+idx*rowH;
    ctx.fillStyle=cDim; ctx.font="12px sans-serif"; ctx.textAlign="right";
    ctx.fillText(cat, padL-10, y+rowH/2+4);
    const w = barMax*(val/max);
    ctx.fillStyle=cPrimary; ctx.globalAlpha=.85;
    ctx.fillRect(padL,y+4,Math.max(2,w),rowH-12); ctx.globalAlpha=1;
    ctx.fillStyle=cDim; ctx.textAlign="left"; ctx.fillText(val, padL+w+8, y+rowH/2+4);
  });
}

/* ================================================================
   SECTION 6 — RENDERING: WORKLOAD
   ================================================================ */
let wlSort = { k:"util", dir:-1 };
function renderWorkload(){
  const q = $("#wlSearch").value.toLowerCase().trim();
  const sf = $("#wlStatus").value;
  let rows = state.people.map(p=>{ const u=utilization(p); return {p,...u}; })
    .filter(r => (!q || r.p.name.toLowerCase().includes(q) || r.p.role.toLowerCase().includes(q)))
    .filter(r => (!sf || r.p.status===sf));

  rows.sort((a,b)=>{
    const k=wlSort.k;
    let av,bv;
    if(k==="name"){av=a.p.name;bv=b.p.name;} else if(k==="role"){av=a.p.role;bv=b.p.role;}
    else {av=a[k];bv=b[k];}
    return (av>bv?1:av<bv?-1:0)*wlSort.dir;
  });

  const over = rows.filter(r=>r.pct>100).length;
  const idle = rows.filter(r=>r.pct<50 && r.p.status!=="On Leave").length;
  $("#wlFlags").innerHTML = `
    <div class="card"><div class="label">Over-allocated</div><div class="value" style="color:var(--red)">${over}</div><div class="sub">above 100% capacity</div></div>
    <div class="card"><div class="label">High idle capacity</div><div class="value" style="color:var(--amber)">${idle}</div><div class="sub">below 50% utilization</div></div>
    <div class="card"><div class="label">Healthy load</div><div class="value" style="color:var(--green)">${rows.length-over-idle}</div><div class="sub">50–100% range</div></div>`;

  const tb = $("#wlTable tbody");
  if(!rows.length){ tb.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="big">🗂️</div>No matching people.</div></td></tr>`; return; }
  tb.innerHTML = rows.map(r=>{
    const cls = r.pct>100?"red":(r.pct<50?"amber":"green");
    const barColor = r.pct>100?"var(--red)":(r.pct<50?"var(--amber)":"var(--green)");
    const flag = r.pct>100?`<span class="pill red">Over-allocated</span>`
               : (r.pct<50 && r.p.status!=="On Leave")?`<span class="pill amber">Idle capacity</span>`
               : `<span class="pill green">Balanced</span>`;
    return `<tr>
      <td><strong>${esc(r.p.name)}</strong><br><span style="color:var(--text-dim);font-size:.78rem">${esc(r.p.location)}</span></td>
      <td>${esc(r.p.role)}</td>
      <td>${r.cap}h</td>
      <td>${r.alloc}h</td>
      <td><div class="bar-mini"><span style="width:${Math.min(100,r.pct)}%;background:${barColor}"></span></div></td>
      <td><span class="pill ${cls}">${r.pct}%</span></td>
      <td>${flag}</td>
    </tr>`;
  }).join("");
}

/* ================================================================
   SECTION 7 — RENDERING: PEOPLE / INITIATIVES / ALLOCATIONS TABLES
   ================================================================ */
const sortState = { ppl:{k:"name",dir:1}, ini:{k:"name",dir:1}, all:{k:"person",dir:1} };

function statusPill(s){
  const map={ "Available":"green","Partially Allocated":"blue","Fully Allocated":"amber","On Leave":"gray" };
  return `<span class="pill ${map[s]||'gray'}">${esc(s)}</span>`;
}
function prioPill(p){ const map={High:"red",Med:"amber",Low:"gray"}; return `<span class="pill ${map[p]||'gray'}">${esc(p)}</span>`; }
function iniStatusPill(s){ const map={"In Progress":"blue","Not Started":"gray","On Hold":"amber","Done":"green"}; return `<span class="pill ${map[s]||'gray'}">${esc(s)}</span>`; }

function renderPeople(){
  const q=$("#pplSearch").value.toLowerCase().trim();
  const sf=$("#pplStatus").value;
  let rows=state.people.filter(p=>(!q||p.name.toLowerCase().includes(q)||p.role.toLowerCase().includes(q))).filter(p=>(!sf||p.status===sf));
  const s=sortState.ppl;
  rows.sort((a,b)=>{ let av=a[s.k]??"",bv=b[s.k]??""; if(s.k==="capacity"){av=+av;bv=+bv;} return (av>bv?1:av<bv?-1:0)*s.dir; });
  const tb=$("#pplTable tbody");
  if(!rows.length){ tb.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="big">👥</div>No people found. Add one to get started.</div></td></tr>`; return; }
  tb.innerHTML=rows.map(p=>`<tr>
    <td><strong>${esc(p.name)}</strong></td><td>${esc(p.role)}</td><td>${esc(p.location)}</td>
    <td>${statusPill(p.status)}</td><td>${esc(p.capacity)}</td><td>${fmtDate(p.availableFrom)}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-edit-person="${p.id}">Edit</button>
      <button class="btn sm danger" data-del-person="${p.id}">Delete</button>
    </div></td></tr>`).join("");
}

function renderInitiatives(){
  const q=$("#iniSearch").value.toLowerCase().trim();
  const cf=$("#iniCat").value, pf=$("#iniPrio").value;
  let rows=state.initiatives
    .filter(i=>(!q||i.name.toLowerCase().includes(q)||(i.owner||"").toLowerCase().includes(q)))
    .filter(i=>(!cf||i.category===cf)).filter(i=>(!pf||i.priority===pf));
  const s=sortState.ini;
  rows.sort((a,b)=>{ let av=a[s.k]??"",bv=b[s.k]??""; return (av>bv?1:av<bv?-1:0)*s.dir; });
  const tb=$("#iniTable tbody");
  if(!rows.length){ tb.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="big">🎯</div>No initiatives found.</div></td></tr>`; return; }
  tb.innerHTML=rows.map(i=>`<tr>
    <td><strong>${esc(i.name)}</strong></td><td>${esc(i.category)}</td><td>${esc(i.owner)}</td>
    <td>${prioPill(i.priority)}</td><td>${iniStatusPill(i.status)}</td><td>${fmtDate(i.targetDate)}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-edit-ini="${i.id}">Edit</button>
      <button class="btn sm danger" data-del-ini="${i.id}">Delete</button>
    </div></td></tr>`).join("");
}

function renderAllocations(){
  const q=$("#allSearch").value.toLowerCase().trim();
  let rows=state.allocations.map(a=>({
    ...a, personName:(personById(a.personId)||{}).name||"(deleted)",
    iniName:(initById(a.initiativeId)||{}).name||"(deleted)"
  })).filter(a=>(!q||a.personName.toLowerCase().includes(q)||a.iniName.toLowerCase().includes(q)));
  const s=sortState.all;
  rows.sort((a,b)=>{
    let av,bv;
    if(s.k==="person"){av=a.personName;bv=b.personName;}
    else if(s.k==="initiative"){av=a.iniName;bv=b.iniName;}
    else {av=a[s.k]??"";bv=b[s.k]??"";}
    if(s.k==="hours"){av=+av;bv=+bv;}
    return (av>bv?1:av<bv?-1:0)*s.dir;
  });
  const tb=$("#allTable tbody");
  if(!rows.length){ tb.innerHTML=`<tr><td colspan="6"><div class="empty"><div class="big">🔗</div>No allocations yet.</div></td></tr>`; return; }
  tb.innerHTML=rows.map(a=>`<tr>
    <td><strong>${esc(a.personName)}</strong></td><td>${esc(a.iniName)}</td>
    <td>${esc(a.hours)}h</td><td>${fmtDate(a.start)}</td><td>${fmtDate(a.end)}</td>
    <td><div class="row-actions">
      <button class="btn sm" data-edit-all="${a.id}">Edit</button>
      <button class="btn sm danger" data-del-all="${a.id}">Delete</button>
    </div></td></tr>`).join("");
}

function renderAll(){ renderDashboard(); renderWorkload(); renderPeople(); renderInitiatives(); renderAllocations(); }

/* ================================================================
   SECTION 8 — MODAL / FORM ENGINE
   ================================================================ */
let modalSaveHandler = null;
function openModal(title, bodyHTML, onSave){
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHTML;
  modalSaveHandler = onSave;
  $("#modalBack").classList.add("open");
  const first = $("#modalBody input, #modalBody select");
  if(first) first.focus();
}
function closeModal(){ $("#modalBack").classList.remove("open"); modalSaveHandler=null; }
$("#modalClose").onclick = closeModal;
$("#modalCancel").onclick = closeModal;
$("#modalBack").addEventListener("click", e=>{ if(e.target===$("#modalBack")) closeModal(); });
$("#modalSave").onclick = ()=>{ if(modalSaveHandler) modalSaveHandler(); };
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

function field(id,label,inputHTML,err="This field is required."){
  return `<label class="field" id="f_${id}"><span>${label}</span>${inputHTML}<div class="err">${err}</div></label>`;
}
function markInvalid(id,bad){ const el=$("#f_"+id); if(el) el.classList.toggle("invalid",bad); }

/* ---- People form ---- */
function personForm(p={}){
  return `
    <div class="grid2">
      ${field("name","Full name",`<input id="m_name" value="${esc(p.name||"")}" required />`)}
      ${field("role","Role / title",`<input id="m_role" value="${esc(p.role||"")}" required />`)}
      ${field("location","Location",`<input id="m_location" value="${esc(p.location||"")}" required />`)}
      ${field("status","Availability status",`<select id="m_status">${STATUSES.map(s=>`<option ${p.status===s?"selected":""}>${s}</option>`).join("")}</select>`)}
      ${field("capacity","Weekly capacity (h)",`<input id="m_capacity" type="number" min="0" max="80" value="${p.capacity??40}" required />`,"Enter a number between 0 and 80.")}
      ${field("availableFrom","Available from",`<input id="m_availableFrom" type="date" value="${esc(p.availableFrom||"")}" />`)}
    </div>`;
}
function savePerson(existing){
  const name=$("#m_name").value.trim(), role=$("#m_role").value.trim(),
        location=$("#m_location").value.trim(), status=$("#m_status").value,
        capacity=Number($("#m_capacity").value), availableFrom=$("#m_availableFrom").value;
  let ok=true;
  markInvalid("name",!name); markInvalid("role",!role); markInvalid("location",!location);
  const capBad = !(capacity>=0 && capacity<=80); markInvalid("capacity",capBad);
  if(!name||!role||!location||capBad) ok=false;
  if(!ok){ toast("Please fix the highlighted fields.","err"); return; }
  if(existing){ Object.assign(existing,{name,role,location,status,capacity,availableFrom}); toast("Person updated.","ok"); }
  else { state.people.push({id:uid("p"),name,role,location,status,capacity,availableFrom}); toast("Person added.","ok"); }
  persist(); closeModal(); renderAll();
}

/* ---- Initiative form ---- */
function initiativeForm(i={}){
  const cats=CATEGORIES.map(c=>`<option ${i.category===c?"selected":""}>${c}</option>`).join("");
  const prios=["High","Med","Low"].map(p=>`<option ${i.priority===p?"selected":""}>${p}</option>`).join("");
  const stats=["Not Started","In Progress","On Hold","Done"].map(s=>`<option ${i.status===s?"selected":""}>${s}</option>`).join("");
  return `
    ${field("iname","Initiative name",`<input id="m_iname" value="${esc(i.name||"")}" required />`)}
    <div class="grid2">
      ${field("icat","Category",`<select id="m_icat">${cats}</select>`)}
      ${field("iowner","Owner",`<input id="m_iowner" value="${esc(i.owner||"")}" required />`)}
      ${field("iprio","Priority",`<select id="m_iprio">${prios}</select>`)}
      ${field("istatus","Status",`<select id="m_istatus">${stats}</select>`)}
    </div>
    ${field("itarget","Target date",`<input id="m_itarget" type="date" value="${esc(i.targetDate||"")}" />`)}`;
}
function saveInitiative(existing){
  const name=$("#m_iname").value.trim(), category=$("#m_icat").value, owner=$("#m_iowner").value.trim(),
        priority=$("#m_iprio").value, status=$("#m_istatus").value, targetDate=$("#m_itarget").value;
  let ok=true; markInvalid("iname",!name); markInvalid("iowner",!owner);
  if(!name||!owner) ok=false;
  if(!ok){ toast("Please fix the highlighted fields.","err"); return; }
  if(existing){ Object.assign(existing,{name,category,owner,priority,status,targetDate}); toast("Initiative updated.","ok"); }
  else { state.initiatives.push({id:uid("i"),name,category,owner,priority,status,targetDate}); toast("Initiative added.","ok"); }
  persist(); closeModal(); renderAll();
}

/* ---- Allocation form ---- */
function allocationForm(a={}){
  if(!state.people.length || !state.initiatives.length){
    return `<div class="empty"><div class="big">⚠️</div>You need at least one person and one initiative before creating an allocation.</div>`;
  }
  const ppl=state.people.map(p=>`<option value="${p.id}" ${a.personId===p.id?"selected":""}>${esc(p.name)}</option>`).join("");
  const inis=state.initiatives.map(i=>`<option value="${i.id}" ${a.initiativeId===i.id?"selected":""}>${esc(i.name)}</option>`).join("");
  return `
    ${field("aperson","Person",`<select id="m_aperson">${ppl}</select>`)}
    ${field("aini","Initiative",`<select id="m_aini">${inis}</select>`)}
    ${field("ahours","Hours per week",`<input id="m_ahours" type="number" min="1" max="80" value="${a.hours??10}" required />`,"Enter hours between 1 and 80.")}
    <div class="grid2">
      ${field("astart","Start date",`<input id="m_astart" type="date" value="${esc(a.start||"")}" />`)}
      ${field("aend","End date",`<input id="m_aend" type="date" value="${esc(a.end||"")}" />`)}
    </div>`;
}
function saveAllocation(existing){
  if(!state.people.length||!state.initiatives.length){ closeModal(); return; }
  const personId=$("#m_aperson").value, initiativeId=$("#m_aini").value,
        hours=Number($("#m_ahours").value), start=$("#m_astart").value, end=$("#m_aend").value;
  let ok=true; const hBad=!(hours>=1&&hours<=80); markInvalid("ahours",hBad);
  const dateBad = start && end && end<start; markInvalid("aend",dateBad);
  if(dateBad) $("#f_aend .err").textContent="End date must be after start date.";
  if(hBad||dateBad) ok=false;
  if(!ok){ toast("Please fix the highlighted fields.","err"); return; }
  if(existing){ Object.assign(existing,{personId,initiativeId,hours,start,end}); toast("Allocation updated.","ok"); }
  else { state.allocations.push({id:uid("a"),personId,initiativeId,hours,start,end}); toast("Allocation added.","ok"); }
  persist(); closeModal(); renderAll();
}

/* ================================================================
   SECTION 9 — EVENT HANDLERS (buttons, tabs, tables)
   ================================================================ */
// Tabs
$$("nav.tabs button").forEach(btn=>btn.addEventListener("click",()=>{
  $$("nav.tabs button").forEach(b=>b.classList.remove("active"));
  $$("section.view").forEach(v=>v.classList.remove("active"));
  btn.classList.add("active");
  $("#"+btn.dataset.view).classList.add("active");
  if(btn.dataset.view==="dashboard"){ drawCapacityChart(); drawCategoryChart(); }
}));

// Add buttons
$("#addPerson").onclick = ()=> openModal("Add person", personForm(), ()=>savePerson(null));
$("#addInitiative").onclick = ()=> openModal("Add initiative", initiativeForm(), ()=>saveInitiative(null));
$("#addAllocation").onclick = ()=> openModal("Add allocation", allocationForm(), ()=>saveAllocation(null));

// Delegated table actions
document.addEventListener("click", e=>{
  const t=e.target;
  // People
  if(t.dataset.editPerson){ const p=personById(t.dataset.editPerson); openModal("Edit person", personForm(p), ()=>savePerson(p)); }
  if(t.dataset.delPerson){ confirmDelete("Delete this person and their allocations?", ()=>{
    const id=t.dataset.delPerson;
    state.people=state.people.filter(p=>p.id!==id);
    state.allocations=state.allocations.filter(a=>a.personId!==id);
    persist(); renderAll(); toast("Person deleted.","warn");
  }); }
  // Initiatives
  if(t.dataset.editIni){ const i=initById(t.dataset.editIni); openModal("Edit initiative", initiativeForm(i), ()=>saveInitiative(i)); }
  if(t.dataset.delIni){ confirmDelete("Delete this initiative and its allocations?", ()=>{
    const id=t.dataset.delIni;
    state.initiatives=state.initiatives.filter(i=>i.id!==id);
    state.allocations=state.allocations.filter(a=>a.initiativeId!==id);
    persist(); renderAll(); toast("Initiative deleted.","warn");
  }); }
  // Allocations
  if(t.dataset.editAll){ const a=state.allocations.find(x=>x.id===t.dataset.editAll); openModal("Edit allocation", allocationForm(a), ()=>saveAllocation(a)); }
  if(t.dataset.delAll){ confirmDelete("Delete this allocation?", ()=>{
    const id=t.dataset.delAll;
    state.allocations=state.allocations.filter(a=>a.id!==id);
    persist(); renderAll(); toast("Allocation deleted.","warn");
  }); }
});

function confirmDelete(msg,onYes){
  openModal("Confirm", `<p style="margin:0 0 4px">${esc(msg)}</p><p style="color:var(--text-dim);font-size:.82rem">This cannot be undone.</p>`, ()=>{ onYes(); closeModal(); });
  $("#modalSave").textContent="Delete"; $("#modalSave").classList.add("danger");
  // restore button after close
  const restore=()=>{ $("#modalSave").textContent="Save"; $("#modalSave").classList.remove("danger"); $("#modalClose").removeEventListener("click",restore); };
  $("#modalClose").addEventListener("click",restore);
  $("#modalCancel").addEventListener("click",restore,{once:true});
}

// Filters / search (debounced-ish via direct input)
["#wlSearch","#wlStatus"].forEach(s=>$(s).addEventListener("input",renderWorkload));
["#pplSearch","#pplStatus"].forEach(s=>$(s).addEventListener("input",renderPeople));
["#iniSearch","#iniCat","#iniPrio"].forEach(s=>$(s).addEventListener("input",renderInitiatives));
$("#allSearch").addEventListener("input",renderAllocations);

// Sortable headers
function wireSort(tableSel, sortObj, renderFn){
  $$(tableSel+" thead th[data-k]").forEach(th=>th.addEventListener("click",()=>{
    const k=th.dataset.k;
    if(sortObj.k===k) sortObj.dir*=-1; else { sortObj.k=k; sortObj.dir=1; }
    renderFn();
  }));
}
wireSort("#pplTable", sortState.ppl, renderPeople);
wireSort("#iniTable", sortState.ini, renderInitiatives);
wireSort("#allTable", sortState.all, renderAllocations);
$$("#wlTable thead th[data-k]").forEach(th=>th.addEventListener("click",()=>{
  const k=th.dataset.k; if(wlSort.k===k) wlSort.dir*=-1; else {wlSort.k=k; wlSort.dir=1;} renderWorkload();
}));

/* ================================================================
   SECTION 10 — IMPORT / EXPORT (JSON + CSV)
   ================================================================ */
function download(filename, text, mime="application/json"){
  const blob=new Blob([text],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}
$("#btnExport").onclick=()=>{
  download("bench-tracker-"+new Date().toISOString().slice(0,10)+".json", JSON.stringify(state,null,2));
  toast("Data exported as JSON.","ok");
};
$("#btnImport").onclick=()=>$("#fileInput").click();
$("#fileInput").addEventListener("change",e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(!data.people||!data.initiatives||!data.allocations) throw new Error("bad shape");
      // basic dedupe of ids on import
      state=data; persist(); renderAll(); toast("Data imported successfully.","ok");
    }catch(err){ toast("Import failed: invalid JSON file.","err"); }
    $("#fileInput").value="";
  };
  r.readAsText(f);
});

function toCSV(rows, headers){
  const escC=v=>{ v=String(v??""); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  return [headers.join(","), ...rows.map(r=>r.map(escC).join(","))].join("\n");
}
$("#pplCsv").onclick=()=>{
  const rows=state.people.map(p=>[p.name,p.role,p.location,p.status,p.capacity,p.availableFrom]);
  download("people.csv", toCSV(rows,["Name","Role","Location","Status","Capacity","AvailableFrom"]),"text/csv");
  toast("People exported as CSV.","ok");
};
$("#iniCsv").onclick=()=>{
  const rows=state.initiatives.map(i=>[i.name,i.category,i.owner,i.priority,i.status,i.targetDate]);
  download("initiatives.csv", toCSV(rows,["Name","Category","Owner","Priority","Status","TargetDate"]),"text/csv");
  toast("Initiatives exported as CSV.","ok");
};
$("#allCsv").onclick=()=>{
  const rows=state.allocations.map(a=>[(personById(a.personId)||{}).name||"",(initById(a.initiativeId)||{}).name||"",a.hours,a.start,a.end]);
  download("allocations.csv", toCSV(rows,["Person","Initiative","Hours","Start","End"]),"text/csv");
  toast("Allocations exported as CSV.","ok");
};

// Reset demo
$("#btnReset").onclick=()=>{
  confirmDelete("Reset all data back to the demo dataset?", ()=>{
    state=seedData(); persist(); renderAll(); toast("Demo data restored.","ok");
  });
};

/* ================================================================
   SECTION 11 — THEME
   ================================================================ */
function applyTheme(mode){
  document.body.setAttribute("data-theme", mode==="dark"?"dark":"light");
  $("#themeToggle").checked = mode==="dark";
  Storage.theme(mode);
  // redraw canvases so colors match the theme
  drawCapacityChart(); drawCategoryChart();
}
$("#themeToggle").addEventListener("change",e=> applyTheme(e.target.checked?"dark":"light"));
const savedTheme = Storage.theme() || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light");
applyTheme(savedTheme);

/* ================================================================
   SECTION 12 — INIT + RESIZE
   ================================================================ */
let resizeT;
window.addEventListener("resize",()=>{ clearTimeout(resizeT); resizeT=setTimeout(()=>{ drawCapacityChart(); drawCategoryChart(); },150); });
renderAll();
