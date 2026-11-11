/* Barcelona Gardens — Field Record Editor v1.1
   Public Pay App #3 quantities are read-only. Field revisions are saved locally
   and can be exported/imported; no external server or shared sync is implied. */
(function BarcelonaFieldReportEditor(){
'use strict';
const api=window.BarcelonaViewer;
if(!api||!Array.isArray(api.marks)){console.warn('Barcelona Field Report: viewer not ready');return;}
const $=(s,r=document)=>r.querySelector(s);
const KEY='barcelona.field.report.v1';
const STATUS={not_reviewed:'Not reviewed',observed:'Condition observed',measured:'Field measured',submitted:'Submitted for review',approved:'Approved (recorded)',in_progress:'In progress',completed:'Work reported complete',hold:'On hold'};
const COLORS={observed:'#A75B40',measured:'#287FB2',submitted:'#8A61BE',approved:'#476C9D',in_progress:'#C78A28',completed:'#27936F',hold:'#CF4E4D'};
const RECOMMEND={
  B:['4E/4F','4J','4K','4L'], 'B/E':['4E/4F','4D','4K','4L'],'BL':['4S','4U','4J'],'BR':['4S','4U'], 'BR/ST':['4S','4U'],
  ST:['4S','4U','4T'],'ST/W':['4S','4U','4T'],E:['4D','4E/4F'], 'E/OH':['4A','4D','4E/4F'],RS:['4G','4R','4T'],
  FL:['4M','4N','4O','4T'],'FL*':['4M','4N','4O','4T'],CK:['4E/4F','4S','4J'],SP:['4A','4S'],C:[]
};
const GUIDANCE={
  B:['Photograph crack and dimensions','Sound to identify delamination or hollow areas','Confirm structural repair detail with Engineer of Record'],
  ST:['Sound and outline delaminated stucco','Verify substrate, moisture and extent','Match specified stucco assembly and finish'],
  RS:['Document source and extent of corrosion','Check exposed reinforcement / shutter hardware as applicable','Use engineer-approved corrosion and coating repair procedure'],
  FL:['Verify water infiltration and existing substrate','Confirm slope, drains and terminations','Document surface prep and approved waterproofing system'],
  E:['Survey edge/overhead deterioration and protection','Confirm partial versus full-depth scope with engineer','Measure actual repair section before quantities are recorded'],
  C:['Verify original NV5 code and coordinate with engineer before defining scope']
};
const q=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n)=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{maximumFractionDigits:3}):'—';
const today=()=>new Date().toISOString().slice(0,10);
let DATA=null,tab='edit',opened=false,active=api.state.sel?.id??api.marks[0]?.id??0,building='100',showAll=false,lastSave='';
let record={schemaVersion:1,revision:'Field revision 01',preparedBy:'',items:{},updated:''};
try{const old=JSON.parse(localStorage.getItem(KEY)||'null');if(old&&typeof old.items==='object'&&old.items&&!Array.isArray(old.items)){
  record={schemaVersion:1,revision:old.revision||old.meta?.revision||'Field revision 01',preparedBy:old.preparedBy||old.meta?.preparedBy||'',items:old.items,updated:old.updated||''};
}}catch(e){console.warn('Saved field record could not be loaded',e);}
const fileInfo='October 24, 2026 field quantities · Pay App #3';
function st(id){return record.items[String(id)]?.status||'not_reviewed';}
function count(){return Object.values(record.items).filter(x=>x&&x.status&&x.status!=='not_reviewed').length;}
function colorFor(id){return COLORS[st(id)]||null;}
function summaryText(){const updated=count();return updated?' · '+updated+' field record'+(updated===1?'':'s')+' updated':'';}
window.BarcelonaField={colorFor,summaryText,open:(id)=>open(id),getRecord:()=>record,getSource:()=>DATA};
const link=document.createElement('link');link.rel='stylesheet';link.href='report-editor.css';document.head.appendChild(link);
const trigger=document.createElement('button');trigger.type='button';trigger.id='fieldOpenBtn';trigger.className='report-link field-open';trigger.innerHTML='✎ <strong>Field Records</strong><span id="fieldCount"></span>';
trigger.setAttribute('aria-controls','fieldSheet');trigger.setAttribute('aria-expanded','false');
trigger.addEventListener('click',()=>open());$('.top')?.appendChild(trigger);
const backdrop=document.createElement('button');backdrop.type='button';backdrop.id='fieldVeil';backdrop.className='field-veil';backdrop.setAttribute('aria-label','Close records');backdrop.hidden=true;document.body.appendChild(backdrop);
const sheet=document.createElement('aside');sheet.id='fieldSheet';sheet.className='field-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Barcelona field reports');sheet.setAttribute('aria-modal','true');sheet.hidden=true;document.body.appendChild(sheet);
const toast=document.createElement('div');toast.id='fieldToast';toast.className='field-toast';toast.hidden=true;toast.setAttribute('role','status');document.body.appendChild(toast);
backdrop.addEventListener('click',close);
function note(text){toast.textContent=text;toast.hidden=false;requestAnimationFrame(()=>toast.classList.add('visible'));setTimeout(()=>{toast.classList.remove('visible');setTimeout(()=>toast.hidden=true,280);},2350);}
function save(){record.updated=new Date().toISOString();try{localStorage.setItem(KEY,JSON.stringify(record));lastSave='Saved on this device';}catch(e){lastSave='Storage unavailable — export backup';}
  const countEl=$('#fieldCount');if(countEl)countEl.textContent=count()?' · '+count():'';
  api.refresh?.();$('#fieldStatus')?.replaceChildren(document.createTextNode(lastSave));
  try{localStorage.setItem('barcelona.field.ping',String(Date.now()));}catch(e){}
}
function update(id,changes){const key=String(id);record.items[key]={...(record.items[key]||{}),...changes,updated:new Date().toISOString()};save();}
function open(id){if(Number.isInteger(id)&&api.marks[id])active=id;else if(api.state.sel)active=api.state.sel.id;
 opened=true;sheet.hidden=false;backdrop.hidden=false;trigger.setAttribute('aria-expanded','true');render();
 requestAnimationFrame(()=>{sheet.classList.add('visible');backdrop.classList.add('visible');});}
function close(){opened=false;sheet.classList.remove('visible');backdrop.classList.remove('visible');trigger.setAttribute('aria-expanded','false');setTimeout(()=>{if(!opened){sheet.hidden=true;backdrop.hidden=true;}},360);}
function getMark(){return api.marks.find(m=>m.id===active)||api.marks[0];}
function scope(code){return DATA?.scope?.find(s=>s.code===code)||null;}
function guide(m){if(m.code.startsWith('FL'))return GUIDANCE.FL;if(m.code==='RS')return GUIDANCE.RS;if(m.code.startsWith('ST')||m.code.startsWith('BR')||m.code==='BL')return GUIDANCE.ST;if(m.code==='E'||m.code==='E/OH')return GUIDANCE.E;if(m.code==='C'||m.code==='SP')return GUIDANCE.C;return GUIDANCE.B;}
function recommended(m){return RECOMMEND[m.code]||[];}
function where(m){return m.b==='club'?'Clubhouse':`Building ${m.b} · ${m.f===1?'Ground floor':'Second floor'} · Elevation ${m.elev}`;}
function current(id){return record.items[String(id)]||{};}
function sourceQty(m,code){const b=DATA?.buildings?.[m.b],n=b?.totals?.[code];if(n===undefined)return 'No measured quantity on the source Pay App for this item/building.';
  const x=b.measured?.[code]||{},unit=scope(code)?.unit||'';
  const locations=Object.entries(x).map(([key,v])=>`${q(key)} ${fmt(v)} ${q(unit)}`).join(' · ');
  return `Source billed/field-measured to date: <b>${fmt(n)} ${q(unit)}</b>${locations?' · '+locations:''}. Not automatically attributed to this NV5 mark.`;
}
function editedRows(){return api.marks.map(m=>({m,r:current(m.id)})).filter(x=>Object.keys(x.r).some(k=>!['updated'].includes(k)));}
function tabsHTML(){return `<nav class="field-tabs" role="tablist" aria-label="Report sections">${[['edit','Edit mark'],['quantities','Pay App #3'],['sow','Scope / PDF']].map(([k,s])=>`<button type="button" role="tab" data-tab="${k}" aria-selected="${k===tab}">${s}</button>`).join('')}</nav>`;}
function editHTML(){const m=getMark();if(!m)return '<p>No repair marks available.</p>';const d=current(m.id),suggest=recommended(m),choice=d.code||'',options=(DATA?.scope||[]).filter(s=>!['1','2A','2B','3','6'].includes(s.code)),best=options.filter(s=>suggest.includes(s.code)),remaining=options.filter(s=>!suggest.includes(s.code));const statusOptions=Object.entries(STATUS).map(([k,v])=>`<option value="${k}" ${st(m.id)===k?'selected':''}>${q(v)}</option>`).join('');
 const all=api.marks.map(x=>`<option value="${x.id}" ${m.id===x.id?'selected':''}>${q(x.b==='club'?'Club':x.b)} · #${x.id+1} · ${q(x.code)} · ${q(x.note.slice(0,35))}</option>`).join('');
 return `<section class="field-card"><div class="field-pair"><div><h3>NV5 repair #${m.id+1} · ${q(m.code)}</h3><p>${q(m.note)}<br>${q(where(m))}</p></div><span class="field-draft">REFERENCE</span></div>
 <label class="field-label" for="fieldNav">Select repair mark</label><select class="field-select" id="fieldNav" data-navigate>${all}</select>
 <div class="field-actions"><button class="field-btn" data-action="prev">← Previous</button><button class="field-btn" data-action="locate">Locate in elevation</button><button class="field-btn" data-action="next">Next →</button></div></section>
 <section class="field-card"><h3>1. Field observation</h3><div class="field-grid">
 <label><span class="field-label">Current status</span><select data-edit="status" class="field-select">${statusOptions}</select></label>
 <label><span class="field-label">Observed / measured date</span><input data-edit="date" class="field-input" type="date" value="${q(d.date||'')}"></label>
 <label class="field-full"><span class="field-label">Measured by / inspector</span><input data-edit="owner" class="field-input" value="${q(d.owner||'')}" placeholder="Name or initials"></label>
 <label class="field-full"><span class="field-label">Condition and notes</span><textarea data-edit="notes" class="field-area" placeholder="Actual observations, photos, limits and engineer direction…">${q(d.notes||'')}</textarea></label></div></section>
 <section class="field-card"><h3>2. Scope of work</h3><p>Suggested options depend on the selected NV5 condition. Select only the contract item supported by the field evidence and approved drawings.</p>
 <label class="field-label">Contract SOW item</label><select data-edit="code" class="field-select"><option value="">Select SOW item…</option>${best.map(s=>`<option value="${q(s.code)}" ${choice===s.code?'selected':''}>★ ${q(s.code)} — ${q(s.description)}</option>`).join('')}${remaining.map(s=>`<option value="${q(s.code)}" ${choice===s.code?'selected':''}>${q(s.code)} — ${q(s.description)}</option>`).join('')}</select>
 <div class="field-grid" style="margin-top:12px"><label><span class="field-label">Field measurement</span><input class="field-input" type="number" min="0" step="any" inputmode="decimal" data-edit="quantity" value="${d.quantity??''}" placeholder="Not measured"></label><label><span class="field-label">Unit</span><input class="field-input" id="fieldUnit" value="${q(scope(choice)?.unit||'Select item')}" readonly></label></div>
 <p class="field-warning">Do not use measured billing quantities as proof of completed or approved work. Full-depth, structural and concealed repairs require the applicable engineering review.</p>
 <h4>Suggested field workflow</h4>${guide(m).map((s,i)=>`<label class="field-suggestion"><input type="checkbox" data-step="${i}" ${Array.isArray(d.steps)&&d.steps.includes(i)?'checked':''}><span>${q(s)}</span></label>`).join('')}
 ${choice?`<div class="field-bullet"><small>${sourceQty(m,choice)}</small></div>`:''}
 </section>`;}
function quantitiesHTML(){if(!DATA)return '<section class="field-card"><h3>Loading source quantities…</h3><p>If the page is offline, reconnect and reopen the records.</p></section>';
 const b=DATA.buildings[building],totalTypes=Object.entries(b.totals).filter(([c,n])=>n>0&&!['1','2A','2B','3','6'].includes(c)),co=DATA.extraQuantities.filter(x=>x.building===building);
 return `<section class="field-card"><h3>Pay Application #3 · Technical record</h3><p>${q(fileInfo)} · Period ending October 31, 2026. Source: 5-sheet workbook.</p>
 <label class="field-label">Building</label><select class="field-select" data-building>${Object.keys(DATA.buildings).map(k=>`<option ${k===building?'selected':''}>${k}</option>`).join('')}</select>
 <div class="field-kpis" style="margin-top:12px"><div><strong>${totalTypes.length}</strong><small>Measured trade items</small></div><div><strong>${co.length}</strong><small>CO quantity lines</small></div><div><strong>${b.locations.length}</strong><small>Source columns / locations</small></div></div>
 <p class="field-warning">Historical Pay App record (read-only). Financial unit rates and payment values are intentionally omitted from this public app. Values below are measured quantities, not automatically linked to individual NV5 marks.</p></section>
 <section class="field-card"><div class="field-pair"><h3>Measured quantities by SOW</h3><button class="field-btn" data-action="toggle-zeros">${showAll?'Measured only':'Show all items'}</button></div>
 <div class="field-rows">${(showAll?DATA.scope.filter(s=>s.code.startsWith('4')):DATA.scope.filter(s=>totalTypes.some(([code])=>code===s.code))).map(s=>{
 const n=b.totals[s.code]||0;const loc=b.measured[s.code]||{};return `<div class="field-bullet"><b>${q(s.code)} · ${q(s.description)}</b><div class="field-pair"><span>${Object.keys(loc).length?Object.entries(loc).map(([l,n])=>q(l)+': '+fmt(n)).join(' · '):'No measured work to date'}</span><strong>${fmt(n)} ${q(s.unit)}</strong></div></div>`}).join('')}
 </div></section>${co.length?`<section class="field-card"><h3>Change order quantities (not additive)</h3>${co.map(x=>`<div class="field-bullet"><b>${q(x.id)} · ${q(x.code)}</b><span> · ${fmt(x.overage)} ${q(x.unit)} over ${fmt(x.contractBase)} ${q(x.unit)} contract allowance</span></div>`).join('')}<p>Overages are portions of the same measured quantities above, not extra work to add again.</p></section>`:''}`;
}
function sowHTML(){return `<section class="field-card"><h3>Contract scope & field revisions</h3><p>Source: MTD2025-016-12 Schedule of Values and MTD2025-016-25 quantity overages. Scope entries preserve the workbook descriptions and units.</p>
 <div class="field-actions"><button class="field-btn primary" data-action="print">Create revised PDF</button><button class="field-btn" data-action="export">Export backup JSON</button><button class="field-btn" data-action="import">Import backup JSON</button></div><input id="fieldImport" type="file" accept="application/json,.json" hidden>
 <div class="field-grid"><label><span class="field-label">Report revision</span><input class="field-input" data-meta="revision" value="${q(record.revision)}"></label><label><span class="field-label">Prepared by</span><input class="field-input" data-meta="preparedBy" value="${q(record.preparedBy)}" placeholder="Inspector / PM"></label></div>
 <p class="field-warning">This makes a new field revision PDF via your iPhone/browser Print → Save as PDF. It does not overwrite the original 10-sheet technical reference. Edits are saved on this device, not shared to all users automatically.</p>
 <a class="field-btn" style="display:inline-flex;text-decoration:none;align-items:center" href="docs/Barcelona_Gardens_Typical_Elevations.pdf" target="_blank" rel="noopener">Original 10-sheet PDF ↗</a>
 <a class="field-btn" style="display:inline-flex;text-decoration:none;align-items:center;margin-left:5px" href="docs/Barcelona_Pay_App_3_Technical_Quantities.xlsx" download>Excel-compatible record ↓</a>
 </section><section class="field-card"><h3>Source SOW items (${DATA?.scope?.length||'…'})</h3><div class="field-rows">${(DATA?.scope||[]).map(s=>`<div class="field-sow"><code>${q(s.code)}</code><div>${q(s.description)}<small>${q(s.unit)}</small></div></div>`).join('')}</div></section>`;}
function render(){if(!opened)return;
 const markup=`<div class="field-heading"><div><div class="field-eyebrow">BARCELONA GARDENS · MTD</div><h2>Field Records <span class="field-draft">WORKING DRAFT</span></h2><p>Interactive repairs · SOW · Pay App #3</p></div><button type="button" data-action="close" class="field-icon" aria-label="Close field records">×</button></div>${tabsHTML()}
 <div class="field-content">${tab==='edit'?editHTML():tab==='quantities'?quantitiesHTML():sowHTML()}</div>
 <div class="field-footer"><span><span class="field-highlight">${count()} / ${api.marks.length}</span> marks with field updates</span><span id="fieldStatus">${q(lastSave||'Local field draft · not cloud-synced')}</span></div>`;
 sheet.innerHTML=markup;
}
function nav(id){const n=Math.min(api.marks.length-1,Math.max(0,Number(id)||0));active=n;api.selectMark(n,false);render();}
function locate(){const m=getMark();if(!m)return;api.selectMark(m.id,false);api.setBuilding(m.b);api.setElevation(m.elev);api.setView('elev');close();note('Opened selected repair in elevation');}
function download(name,text,mime){const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function downloadBackup(){download(`Barcelona_Field_Records_${today()}.json`,JSON.stringify({...record,source:'Barcelona Gardens interactive field record',snapshotDate:DATA?.source?.measuredThrough||null},null,2),'application/json');note('Field records backup downloaded');}
async function importBackup(){const inp=$('#fieldImport',sheet);if(!inp)return;inp.onchange=async()=>{
 const file=inp.files?.[0];if(!file)return;if(file.size>3_000_000){note('Backup too large');return;}
 try{const data=JSON.parse(await file.text());if(data.schemaVersion!==1||!data.items||typeof data.items!=='object'||Array.isArray(data.items))throw Error('Invalid format');
 const cleaned={};for(const [id,v] of Object.entries(data.items)){if(!/^\d+$/.test(id)||+id>=api.marks.length||!v||typeof v!=='object')continue;
 cleaned[id]={status:STATUS[v.status]?v.status:'not_reviewed',code:typeof v.code==='string'?v.code.slice(0,15):'',quantity:(Number.isFinite(Number(v.quantity))&&Number(v.quantity)>=0&&v.quantity!==null&&v.quantity!=='')?Number(v.quantity):null,notes:String(v.notes||'').slice(0,8000),owner:String(v.owner||'').slice(0,160),date:String(v.date||'').slice(0,10),steps:Array.isArray(v.steps)?v.steps.filter(n=>Number.isInteger(n)&&n>=0&&n<5):[]};}
 record={schemaVersion:1,revision:String(data.revision||'Field revision 01').slice(0,120),preparedBy:String(data.preparedBy||'').slice(0,160),items:cleaned,updated:new Date().toISOString()};save();render();note('Backup imported on this device');}
 catch(e){note('Invalid backup: no changes imported');}
 };inp.click();}
function printDocument(){const changed=editedRows();const source=DATA?.source;
 const rows=changed.length?changed.map(({m,r})=>`<tr><td>#${m.id+1}</td><td>${q(where(m))}<br><small>${q(m.code)} · ${q(m.note)}</small></td><td>${q(STATUS[r.status]||'Not reviewed')}</td><td>${q(r.code||'—')}<br>${r.quantity!=null?q(fmt(r.quantity)+' '+(scope(r.code)?.unit||'')):'No field measurement'}</td><td>${q(r.date||'—')}<br>${q(r.owner||'')}</td><td>${q(r.notes||'')}<br><small>${(r.steps||[]).map(i=>q(guide(m)[i]||'')).join('; ')}</small></td></tr>`).join(''):'<tr><td colspan="6">No mark-level field revisions yet; this is a baseline source record.</td></tr>';
 const quantities=DATA?Object.entries(DATA.buildings).map(([b,d])=>`<h3>Building ${b} · Pay App #3 measured quantities</h3><table><thead><tr><th>SOW</th><th>Description</th><th>Qty to date</th><th>Unit</th></tr></thead><tbody>${DATA.scope.filter(s=>d.totals[s.code]!==undefined&&Number(d.totals[s.code])>0).map(s=>`<tr><td>${q(s.code)}</td><td>${q(s.description)}</td><td>${fmt(d.totals[s.code])}</td><td>${q(s.unit)}</td></tr>`).join('')}</tbody></table>`).join(''):'<p>Source quantities unavailable; refresh the app and regenerate the report.</p>';
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Barcelona Gardens · ${q(record.revision)}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>
 @page{size:letter;margin:15mm}*{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;color:#1b2228;font-size:10.5px;line-height:1.45;margin:0;background:#fff}
 h1{font-size:26px;line-height:1.1;margin:0 0 7px}h2{font-size:18px;border-top:2px solid #B84232;padding-top:12px;margin-top:28px;break-after:avoid}h3{font-size:14px;margin-top:20px;break-after:avoid}.meta{color:#59636a;font-size:11px}.stamp{color:#934034;font-weight:700;letter-spacing:.08em;font-size:10px}table{width:100%;border-collapse:collapse;margin:12px 0;table-layout:fixed}th{background:#f3f0ee;text-align:left;font-size:10px}td,th{border:1px solid #d7dadd;padding:6px;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}small{font-size:9px;color:#59636a}p{margin:6px 0}.warn{background:#fff2e7;border-left:3px solid #B84232;padding:9px 12px}.printbar{position:sticky;top:0;background:#1c252e;color:#fff;padding:12px;text-align:center;margin-bottom:18px}.printbar button{background:#F5DED8;border:0;border-radius:8px;padding:8px 13px;font-weight:700;cursor:pointer}.signature{margin-top:44px;display:flex;justify-content:space-between;gap:20px}.signature div{width:48%;border-top:1px solid #77818a;padding-top:6px;font-size:10px}@media print{.printbar{display:none}}
 </style></head><body><div class="printbar"><button onclick="window.print()">Print / Save as PDF</button> · Use the iPhone share/print menu to save a PDF</div>
 <header><div class="stamp">MTD PAINTING &amp; CONSTRUCTION CORP. · FIELD REVISION — NOT SIGNED DRAWINGS</div><h1>Barcelona Gardens</h1><p>Concrete and stucco restoration · 101 E McNab Rd, Pompano Beach, FL 33060</p><p class="meta">Contract ${q(source?.contract||'MTD2025-016-12')} · ${q(record.revision)} · Prepared by ${q(record.preparedBy||'Not entered')} · Generated ${q(new Date().toLocaleString())}</p></header>
 <p class="warn">This is a field-status and quantity coordination record. Pay Application #3 quantities are measured billing backup through October 24, 2026, not certified completion. Engineer review and final acceptance must be recorded independently. Contract price/rate information is not included.</p>
 <h2>1 · Repair mark revisions (${changed.length})</h2><table><thead><tr><th style="width:5%">Mark</th><th style="width:24%">NV5 location</th><th style="width:13%">Field status</th><th style="width:12%">SOW / Qty</th><th style="width:13%">Recorded by</th><th>Observations and action</th></tr></thead><tbody>${rows}</tbody></table>
 <h2>2 · Source record: Pay App #3</h2><p>Original source: ${q(source?.file||'Barcelona Gardens Quantities - Pay App 3_5 (1).xlsx')} · Measurements through October 24, 2026 · Period ending October 31, 2026. Numbers are shown without dollar values.</p>${quantities}
 <h2>3 · Change order quantity overages (not additive)</h2><table><thead><tr><th>CO</th><th>Building</th><th>SOW item</th><th>Qty over base</th><th>Contract base</th></tr></thead><tbody>${(DATA?.extraQuantities||[]).map(c=>`<tr><td>${q(c.id)}</td><td>${q(c.building)}</td><td>${q(c.code)}</td><td>${fmt(c.overage)} ${q(c.unit)}</td><td>${fmt(c.contractBase)} ${q(c.unit)}</td></tr>`).join('')}</tbody></table>
 <h2>4 · Reference documents and limitations</h2><p>MTD Typical Elevations · 10-page coordination reference dated November 11, 2026, based on NV5 drawings. Existing geometry and repair heights include estimates, not survey-certified elevations. This revision is separate from the original PDF, which is preserved unchanged.</p>
 <div class="signature"><div>Field preparer / date</div><div>Engineer of Record / approval / date (if applicable)</div></div></body></html>`;
 const w=window.open('','_blank');if(!w){note('Allow pop-ups to create the printable report');return;}w.document.open();w.document.write(html);w.document.close();note('Report opened: Print / Save as PDF');}
sheet.addEventListener('click',e=>{const target=e.target.closest('[data-action],[data-tab]');if(!target)return;
 if(target.dataset.tab){tab=target.dataset.tab;render();return;}
 const action=target.dataset.action;
 if(action==='close')close();else if(action==='prev')nav(active-1);else if(action==='next')nav(active+1);else if(action==='locate')locate();else if(action==='toggle-zeros'){showAll=!showAll;render();}
 else if(action==='print')printDocument();else if(action==='export')downloadBackup();else if(action==='import')importBackup();});
sheet.addEventListener('change',e=>{const t=e.target;
 if(t.matches('[data-navigate]')){nav(+t.value);return;}
 if(t.matches('[data-building]')){building=t.value;render();return;}
 if(t.matches('[data-step]')){const id=active,idx=+t.dataset.step,steps=new Set(current(id).steps||[]);if(t.checked)steps.add(idx);else steps.delete(idx);update(id,{steps:Array.from(steps).sort()});return;}
 if(t.matches('[data-edit="code"]')){const old=current(active).code||'';update(active,{code:t.value,quantity:old===t.value?current(active).quantity:null});render();return;}
 if(t.matches('[data-edit="status"]')){update(active,{status:t.value});render();return;}
 if(t.matches('[data-meta]')){record[t.dataset.meta]=t.value.slice(0,160);save();return;}
 if(t.matches('[data-edit]')){const field=t.dataset.edit;let val=t.value;if(field==='quantity'){val=t.value.trim()===''?null:Number(t.value);if(val!=null&&(!Number.isFinite(val)||val<0)){note('Quantity must be positive or blank');return;}}update(active,{[field]:val});}
 });
sheet.addEventListener('focusout',e=>{const t=e.target;if(t.matches('[data-edit="notes"],[data-edit="owner"],[data-edit="date"],[data-edit="quantity"],[data-meta]'))t.dispatchEvent(new Event('change',{bubbles:true}));});
document.addEventListener('click',e=>{const t=e.target.closest('[data-field-open]');if(t){const id=t.dataset.fieldOpen;open(id===''?undefined:Number(id));}});
window.addEventListener('barcelona-mark-selected',e=>{if(!opened)return;if(tab==='edit'&&Number.isInteger(e.detail?.id)){active=e.detail.id;render();}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened)close();});
window.addEventListener('storage',e=>{if(![KEY,'barcelona.field.ping'].includes(e.key))return;try{const r=JSON.parse(localStorage.getItem(KEY)||'null');if(r?.items){record=r;api.refresh?.();if(opened)render();}}catch(err){}});
fetch('data/pay-app-3-quantities-public.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('source not found');return r.json();}).then(r=>{DATA=r;if(opened)render();}).catch(e=>{console.warn('Pay App source unavailable',e);if(opened)render();});
save();
})();