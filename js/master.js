'use strict';
/* Stage 2: Product Master, Customers, Suppliers, Locations */
const MD={
 products:{t:'Product Master',one:'product',f:[['code','Product code','text',1],['description','Description','text',1],['purchase_price','Purchase price','number'],['sale_price','Sale price','number'],['unit','Unit (pcs, box, kg...)','text'],['min_stock','Minimum stock (low-stock warning)','number']]},
 customers:{t:'Customers',one:'customer',f:[['code','Code','text',1],['name','Name','text',1],['phone','Phone','text'],['address','Address','text']]},
 suppliers:{t:'Suppliers',one:'supplier',f:[['code','Code','text',1],['name','Name','text',1],['phone','Phone','text'],['address','Address','text']]},
 locations:{t:'Locations',one:'location',f:[['code','Code (used in invoice numbers, e.g. S1)','text',1],['name','Location name','text',1]]}};
const MQ={};
const mdW=()=>can('master')&&!readOnly();
const mdErr=e=>e.code==='23505'?'This code already exists.':e.code==='23503'?'Cannot delete: it is used elsewhere.':(e.code==='PGRST116'||/row-level security/i.test(e.message))?'You do not have permission to do this.':e.message;

function mdUsed(tbl,r){
 if(tbl==='products')return S.docs.some(d=>d.lines.some(l=>l.code===r.code));
 if(tbl==='customers')return S.docs.some(d=>(d.doc_type==='sale'||d.doc_type==='sret')&&d.partner===r.name);
 if(tbl==='suppliers')return S.docs.some(d=>(d.doc_type==='purchase'||d.doc_type==='pret')&&d.partner===r.name);
 return S.docs.some(d=>d.location_id===r.id||d.to_location_id===r.id)}

function mdPage(tbl){
 const c=MD[tbl];MQ[tbl]='';
 return[c.t,`<div class="page-head"><b id="md_n"></b><div style="display:flex;gap:10px;flex-wrap:wrap"><input class="input" style="width:240px" id="md_q" placeholder="Search..." oninput="MQ['${tbl}']=this.value;mdDraw('${tbl}')">${mdW()?`<button class="btn primary" onclick="mdForm('${tbl}')">+ Add new</button>`:''}</div></div>
 <div class="card"><div class="tw" id="md_t"></div></div>`,()=>mdDraw(tbl)]}

function mdDraw(tbl){
 const c=MD[tbl],q=(MQ[tbl]||'').toLowerCase(),isP=tbl==='products',W=mdW(),s=isP?stock():null,
  tot=code=>Object.values(s[code]||{}).reduce((a,b)=>a+b,0),
  all=S[tbl].filter(r=>!q||c.f.some(([k])=>String(r[k]??'').toLowerCase().includes(q)))
   .sort((a,b)=>String(a.code||'').localeCompare(String(b.code||''),undefined,{numeric:true})),
  rows=all.slice(0,200),cols=c.f.length+(isP?1:0)+1;
 $('#md_n').textContent=all.length+' '+c.one+(all.length===1?'':'s');
 $('#md_t').innerHTML=`<table><thead><tr>${c.f.map(([k,l,ty])=>`<th class="${ty==='number'?'num':''}">${esc(l.split(' (')[0])}</th>`).join('')}${isP?'<th class="num">In stock</th>':''}<th></th></tr></thead><tbody>
 ${rows.map(r=>{const t=isP?tot(r.code):0;
  return`<tr>${c.f.map(([k,,ty])=>`<td class="${ty==='number'?'num':''}" ${k==='address'||k==='description'?'style="white-space:normal;min-width:140px"':''}>${ty==='number'?fmt(r[k]):esc(r[k])}</td>`).join('')}
  ${isP?`<td class="num"><b>${fmt(t)}</b>${t<=r.min_stock?' <span class="badge bad">Low</span>':''}</td>`:''}
  <td class="act">${typeof stmtById==='function'&&(tbl==='customers'||tbl==='suppliers')?`<button class="btn sm" onclick="stmtById('${tbl}','${r.id}')">Statement</button>`:''}${W?`<button class="btn sm" onclick="mdForm('${tbl}','${r.id}')">Edit</button><button class="btn sm d" onclick="mdDel('${tbl}','${r.id}')">Delete</button>`:''}</td></tr>`}).join('')||`<tr><td colspan="${cols}" class="empty">${q?'Nothing found.':'No records yet.'}</td></tr>`}
 ${all.length>200?`<tr><td colspan="${cols}" class="empty">Showing the first 200 of ${all.length}. Use the search box to find the rest.</td></tr>`:''}</tbody></table>`}

function mdForm(tbl,id){
 const c=MD[tbl],r=id?S[tbl].find(x=>x.id===id):{},used=id&&mdUsed(tbl,r),
  lock=k=>!!id&&((tbl==='products'&&k==='code')||((tbl==='customers'||tbl==='suppliers')&&k==='name'&&used));
 let hint='';
 if(id&&tbl==='products')hint='The product code cannot be changed because invoices use it.';
 else if(id&&used&&(tbl==='customers'||tbl==='suppliers'))hint='The name is used in saved invoices, so it cannot be changed.';
 else if(tbl==='locations')hint='Changing the code only affects invoice numbers made from now on.';
 openModal(`<div class="mbox"><h3>${id?'Edit':'Add'} ${c.one}</h3>
 ${c.f.map(([k,l,ty,req])=>`<div class="field"><label>${esc(l)}${req?' *':''}</label><input class="input" id="mf_${k}" type="${ty}" ${ty==='number'?'min="0" step="any" inputmode="decimal"':''} value="${esc(r[k]??'')}" ${lock(k)?'readonly':''}></div>`).join('')}
 ${hint?`<p class="mu" style="margin-bottom:8px">${esc(hint)}</p>`:''}
 <div class="mact"><button class="btn" onclick="mclose()">Cancel</button><button class="btn primary" onclick="mdSave('${tbl}','${id||''}')">Save</button></div></div>`)}

async function mdSave(tbl,id){
 const c=MD[tbl],o={};
 for(const [k,l,ty,req] of c.f){
  let v=$('#mf_'+k).value.trim();
  if(ty==='number'){v=v===''?0:+v;if(!(v>=0))return toast(l.split(' (')[0]+' must be a number, 0 or more')}
  else if(req&&!v)return toast('Please fill: '+l.split(' (')[0]);
  o[k]=v}
 if(S[tbl].some(x=>x.id!==id&&String(x.code).toLowerCase()===o.code.toLowerCase()))return toast('This code already exists.');
 const q=id?sb.from(tbl).update(o).eq('id',id):sb.from(tbl).insert({...o,tenant_id:T}),
  {data,error}=await q.select().single();
 if(error)return toast(mdErr(error));
 S[tbl]=id?S[tbl].map(x=>x.id===id?data:x):[...S[tbl],data];
 mclose();toast('Saved');go(tbl)}

async function mdDel(tbl,id){
 const r=S[tbl].find(x=>x.id===id);if(!r)return;
 if(mdUsed(tbl,r))return toast('Cannot delete: it is used in saved invoices.');
 if(tbl==='locations'&&S.locations.length<2)return toast('Keep at least one location.');
 if(!confirm('Delete '+(r.code||'')+' '+(r.description||r.name||'')+'?'))return;
 const {data,error}=await sb.from(tbl).delete().eq('id',id).select('id');
 if(error)return toast(mdErr(error));
 if(!data||!data.length)return toast('You do not have permission to do this.');
 S[tbl]=S[tbl].filter(x=>x.id!==id);if(LF===id)LF='';
 toast('Deleted');go(tbl)}

addNav('Inventory','products','Product Master');
addNav('Inventory','locations','Locations');
addNav('Sales','customers','Customers');
addNav('Purchase','suppliers','Suppliers','purchase');
V.products=()=>mdPage('products');V.customers=()=>mdPage('customers');V.suppliers=()=>mdPage('suppliers');V.locations=()=>mdPage('locations');
