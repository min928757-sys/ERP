'use strict';
/* Stage 6b: super admin only: Client Accounts, Support view, Backup and Restore */
let CL=[],CURGO='dash',RB=null,RBUSY=false;

const _go6=go;
go=function(id,arg){CURGO=id;_go6(id,arg)};

/* the Admin menu appears only for the super admin account */
const _bn6=buildNav;
buildNav=function(){
 _bn6();
 if(SUP===null){SUP=false;
  sb.rpc('is_super').then(({data})=>{
   if(data!==true)return;SUP=true;
   addNav('Admin','clients','Client Accounts');
   addNav('Admin','backup','Backup and Restore');
   _bn6();
   document.querySelectorAll('.si').forEach(b=>{const on=b.dataset.id===CURGO;b.classList.toggle('on',on);if(on&&b.closest('.grp'))b.closest('.grp').classList.add('open')})})}};

/* banner for support view */
const _shopUI6=shopUI;
shopUI=function(){
 _shopUI6();const m=me();
 if(m.support){const b=$('#sbn');b.style.cssText='background:#fff4dd;color:#8a5300';
  b.innerHTML='Support view (read only): '+esc(m.name)+' <button class="btn sm" onclick="location.reload()">Exit</button>';b.classList.remove('hidden')}};

/* ---------- Client Accounts ---------- */
V.clients=()=>['Client Accounts',`<div class="page-head"><b id="cl_n">Loading...</b><input class="input" style="max-width:240px" id="cl_q" placeholder="Search client or email..." oninput="clDraw()"></div><div class="card"><div class="tw" id="cl"></div></div>`,clLoad];
async function clLoad(){
 const {data,error}=await sb.rpc('admin_clients');
 if(error){$('#cl').innerHTML='<div class="empty">'+esc(error.message)+'</div>';return}
 CL=data;clDraw()}
function clDraw(){
 const q=($('#cl_q')?$('#cl_q').value:'').toLowerCase(),ord={pending:0,paused:1,active:2},
  rows=CL.filter(c=>(c.c_shop+' '+(c.c_owner||'')).toLowerCase().includes(q)).sort((a,b)=>(ord[a.c_status]??2)-(ord[b.c_status]??2)),
  np=CL.filter(c=>c.c_status==='pending').length;
 $('#cl_n').innerHTML=CL.length+' clients'+(np?' &middot; <span class="badge warn">'+np+' waiting for approval</span>':'');
 $('#cl').innerHTML=`<table><thead><tr><th>Client</th><th>Status</th><th>Owner email</th><th>Created</th><th>Last login</th><th class="num">Invoices</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(c=>{
  const ll=c.c_last?new Date(c.c_last):null,d=ll?Math.floor((Date.now()-ll)/864e5):0,
   act=c.c_status==='active'?`<button class="btn sm d" onclick="clSet('${c.c_tenant}','paused')">Pause</button>`:`<button class="btn sm ok" onclick="clSet('${c.c_tenant}','active')">${c.c_status==='pending'?'Approve':'Resume'}</button>`;
  return`<tr><td><b>${esc(c.c_shop)}</b></td><td>${stBadge(c.c_status)}</td><td>${esc(c.c_owner||'-')}</td><td>${c.c_created}</td><td>${ll?ll.toISOString().slice(0,10)+(d>30?' <span class="badge warn">'+d+'d ago</span>':''):'<span class="mu">never</span>'}</td><td class="num">${fmt(c.c_docs)}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${esc(c.c_note||'')}">${esc(c.c_note||'')}</td><td class="act">${act}<button class="btn sm" onclick="clNote('${c.c_tenant}')">Note</button><button class="btn sm" onclick="clAccess('${c.c_tenant}')">Access</button><button class="btn sm primary" onclick="clView('${c.c_tenant}')">View</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No clients found.</td></tr>'}</tbody></table>`}
async function clSet(id,st){
 const c=CL.find(x=>x.c_tenant===id);if(!c)return;let note=null;
 if(st==='paused'){note=prompt('Pause "'+c.c_shop+'". Reason (only you can see this):',c.c_note||'');if(note===null)return}
 else if(!confirm((c.c_status==='pending'?'Approve':'Resume')+' "'+c.c_shop+'"?'))return;
 const {error}=await sb.rpc('admin_set_status',{p_tenant:id,p_status:st,p_note:note});
 if(error)return toast(error.message);toast('Updated');clLoad()}
async function clNote(id){
 const c=CL.find(x=>x.c_tenant===id);if(!c)return;
 const n=prompt('Note about "'+c.c_shop+'" (only you can see this):',c.c_note||'');if(n===null)return;
 const {error}=await sb.rpc('admin_set_status',{p_tenant:id,p_status:c.c_status,p_note:n});
 if(error)return toast(error.message);clLoad()}
async function clAccess(id){
 const c=CL.find(x=>x.c_tenant===id);if(!c)return;
 const {data,error}=await sb.rpc('admin_members',{p_tenant:id});if(error)return toast(error.message);
 openModal(`<div class="mbox"><h3>${esc(c.c_shop)}: who has access</h3><div class="tw"><table><thead><tr><th>Email</th><th>Role</th><th>Last login</th></tr></thead><tbody>${data.map(r=>`<tr><td>${esc(r.m_email)}${r.m_pending?' <span class="badge warn">invited</span>':''}</td><td>${esc(r.m_role)}</td><td>${r.m_last?String(r.m_last).slice(0,10):'-'}</td></tr>`).join('')}</tbody></table></div><div class="mact"><button class="btn" onclick="mclose()">Close</button></div></div>`)}
async function clView(id){
 const c=CL.find(x=>x.c_tenant===id);if(!c)return;
 if(!confirm('Open "'+c.c_shop+'" in read-only support view? This visit is recorded.'))return;
 const {error}=await sb.rpc('log_support',{p_tenant:id});if(error)return toast(error.message);
 MY=MY.filter(m=>!m.support);
 MY.push({id,role:'viewer',perms:null,locs:null,name:c.c_shop,status:'active',support:true});
 T=id;shopUI();
 if(!await load())return toast('Could not open this shop');
 buildNav();go('dash')}

/* ---------- Backup and Restore ---------- */
const canRestore=()=>me().role==='owner'&&!me().support&&!readOnly();
V.backup=()=>['Backup and Restore',`<div class="card"><div class="card-h">Current shop: ${esc(me().name||'')}</div><div class="card-b"><p class="mu" style="margin-bottom:12px">Everything here applies to this shop only. Check the shop name (top right) first.</p><button class="btn ok" onclick="xBackup()">Download backup (.json)</button></div></div>
 <div class="card"><div class="card-h">Restore from a backup file</div><div class="card-b"><p class="mu" style="margin-bottom:12px">Adds only the records that are missing from this shop. It never changes or deletes existing records. Only the shop owner can restore.</p>
 <div class="hg"><div class="field"><label>Backup file (.json)</label><input class="input" id="rf" type="file" accept=".json,application/json"></div><div class="field"><label>&nbsp;</label><button class="btn primary" onclick="rsCheck()">Check file</button></div></div><div id="rs_out"></div></div></div>`];
function xBackup(){
 const o={app:'retailpro',version:2,shop:me().name||'',exported_at:new Date().toISOString(),
  locations:S.locations,products:S.products,customers:S.customers,suppliers:S.suppliers,expenses:S.expenses,expense_categories:S.xcats||[],
  documents:S.docs.map(d=>({id:d.id,doc_type:d.doc_type,doc_no:d.doc_no,doc_date:d.doc_date,partner:d.partner,location_id:d.location_id,to_location_id:d.to_location_id,note:d.note,reason:d.reason,
   lines:d.lines.map(l=>({code:l.code,desc:l.desc,qty:l.qty,price:l.price,cost:l.cost})),
   payments:(d.payments||[]).map(p=>({pay_date:p.pay_date,amount:p.amount,method:p.method,note:p.note,receipt_id:p.receipt_id}))}))};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));
 a.download='retailpro_backup_'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
 try{localStorage.setItem('lastExport',new Date().toLocaleString())}catch(e){}toast('Backup downloaded')}

async function rsCheck(){
 const f=$('#rf').files[0];if(!f)return toast('Choose a backup file first');
 let b;try{b=JSON.parse(await f.text())}catch(e){return toast('This file is not a valid backup')}
 if(!Array.isArray(b.documents)||!Array.isArray(b.products)||!Array.isArray(b.locations))return toast('This is not a RetailPro backup file');
 const miss=(a,k)=>r=>!(a||[]).some(x=>String(x[k]).toLowerCase()===String(r[k]).toLowerCase()),
  loc=b.locations.filter(miss(S.locations,'code')),prod=b.products.filter(miss(S.products,'code')),
  cust=(b.customers||[]).filter(miss(S.customers,'code')),supp=(b.suppliers||[]).filter(miss(S.suppliers,'code')),
  cats=(b.expense_categories||[]).filter(c=>!xcAll().some(n=>n.toLowerCase()===String(c.name).toLowerCase())),
  exp=(b.expenses||[]).filter(r=>!S.expenses.some(x=>x.expense_date===r.expense_date&&x.description===r.description&&+x.amount===+r.amount&&(x.category||'Other')===(r.category||'Other'))),
  docs=b.documents.filter(d=>!S.docs.some(x=>x.doc_type===d.doc_type&&x.doc_no===d.doc_no)),
  n=loc.length+prod.length+cust.length+supp.length+cats.length+exp.length+docs.length;
 RB={b,loc,prod,cust,supp,cats,exp,docs,n};
 const same=b.shop===me().name;
 $('#rs_out').innerHTML=`<div style="margin-top:14px"><p>Backup of <b>${esc(b.shop)}</b>, ${esc((b.exported_at||'').slice(0,10))}. Current shop: <b>${esc(me().name)}</b>.</p>
 ${same?'':'<p style="color:var(--bad);margin-top:6px">The shop names are different. Make sure this is the right shop.</p>'}
 <div class="tw"><table><tbody>${[['Locations',loc],['Products',prod],['Customers',cust],['Suppliers',supp],['Expense categories',cats],['Expenses',exp],['Documents (invoices, returns, transfers, stock in/out)',docs]].map(([k,a])=>`<tr><td>${k}</td><td class="num">${a.length} missing</td></tr>`).join('')}</tbody></table></div>
 ${n?(canRestore()?`<button class="btn ok" style="margin-top:12px" id="rs_go" onclick="rsRun()">Restore ${n} missing records</button>`:'<p class="mu" style="margin-top:10px">Only the owner of this shop can restore.</p>'):'<p class="mu" style="margin-top:10px">Nothing to restore. Everything in this file already exists in this shop.</p>'}</div>`}

async function rsRun(){
 if(RBUSY||!RB||!canRestore())return;
 const {b,loc,prod,cust,supp,cats,exp,docs,n}=RB;
 if(b.shop!==me().name&&!confirm('This backup is from "'+b.shop+'" but you are in "'+me().name+'". Continue?'))return;
 if(!confirm('Add '+n+' missing records to "'+me().name+'"? Existing records will not be changed.'))return;
 RBUSY=true;const btn=$('#rs_go');btn.disabled=true;btn.textContent='Restoring...';
 const ins=async(t,rows,sel)=>{let out=[];
  for(let i=0;i<rows.length;i+=300){const q=sb.from(t).insert(rows.slice(i,i+300)),r=sel?await q.select(sel):await q;if(r.error)throw new Error(t+': '+dErr(r.error));if(r.data)out=out.concat(r.data)}
  return out};
 let made=[],skipped=0;
 try{
  await ins('locations',loc.map(r=>({tenant_id:T,code:r.code,name:r.name})));
  await ins('products',prod.map(r=>({tenant_id:T,code:r.code,description:r.description,purchase_price:r.purchase_price,sale_price:r.sale_price,unit:r.unit,min_stock:r.min_stock})));
  await ins('customers',cust.map(r=>({tenant_id:T,code:r.code,name:r.name,phone:r.phone,address:r.address})));
  await ins('suppliers',supp.map(r=>({tenant_id:T,code:r.code,name:r.name,phone:r.phone,address:r.address})));
  await ins('expense_categories',cats.map(c=>({tenant_id:T,name:c.name})));
  const lr=await sb.from('locations').select('id,code').eq('tenant_id',T);if(lr.error)throw lr.error;
  const byCode=Object.fromEntries(lr.data.map(l=>[String(l.code).toLowerCase(),l.id])),map={};
  b.locations.forEach(l=>map[l.id]=byCode[String(l.code).toLowerCase()]);
  await ins('expenses',exp.map(e=>({tenant_id:T,expense_date:e.expense_date,description:e.description,amount:e.amount,category:e.category||'Other',method:e.method||null,location_id:e.location_id?(map[e.location_id]||null):null})));
  const ok=docs.filter(d=>map[d.location_id]&&(!d.to_location_id||map[d.to_location_id]));skipped=docs.length-ok.length;
  made=await ins('documents',ok.map(d=>({tenant_id:T,doc_type:d.doc_type,doc_no:d.doc_no,doc_date:d.doc_date,partner:d.partner||null,location_id:map[d.location_id],to_location_id:d.to_location_id?map[d.to_location_id]:null,note:d.note||null,reason:d.reason||null})),'id,doc_type,doc_no');
  const idOf={};made.forEach(m=>idOf[m.doc_type+'|'+m.doc_no]=m.id);
  const lines=[],pays=[];
  ok.forEach(d=>{const id=idOf[d.doc_type+'|'+d.doc_no];if(!id)return;const ls=d.lines||[];
   ls.forEach(l=>lines.push({tenant_id:T,document_id:id,product_code:l.code,description:l.desc,qty:l.qty,price:l.price,cost:l.cost||0}));
   if(Array.isArray(d.payments))d.payments.forEach(p=>pays.push({tenant_id:T,document_id:id,pay_date:p.pay_date||today(),amount:p.amount,method:p.method||null,note:p.note||null,receipt_id:p.receipt_id||null}));
   else if(d.doc_type==='sale'||d.doc_type==='purchase'){const t=ls.reduce((a,l)=>a+l.qty*l.price,0);if(t>0)pays.push({tenant_id:T,document_id:id,pay_date:d.doc_date,amount:t,method:'Cash',note:'Restored (paid)'})}});
  await ins('document_lines',lines);await ins('payments',pays);
 }catch(e){
  if(made.length)await sb.from('documents').delete().in('id',made.map(m=>m.id));
  RBUSY=false;btn.disabled=false;btn.textContent='Restore '+n+' missing records';
  return toast('Restore stopped: '+e.message)}
 RBUSY=false;RB=null;await load();
 $('#rs_out').innerHTML=`<p style="margin-top:14px"><b>Done.</b> ${n-skipped} records restored.${skipped?' '+skipped+' documents were skipped because their location is not in the file.':''}</p>`;
 toast('Restore finished')}
