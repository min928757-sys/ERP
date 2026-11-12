'use strict';
/* Stage 8: Goods Received. Stock rises when goods arrive, not when the invoice is saved. */
S.grOff=false;
const grCan=()=>!readOnly()&&can('purchase');
const grBadge=s=>s==='full'?'<span class="badge ok">Received</span>':s==='partial'?'<span class="badge warn">Partly received</span>':'<span class="badge bad">Not received</span>';
let GR=null,GRB=false,GRF='';

/* ordered / received / pending for one purchase */
function grInfo(d){
 const ord={},got={};
 d.lines.forEach(l=>{ord[l.code]=R2((ord[l.code]||0)+l.qty)});
 if(S.grOff||d.receipts==null)Object.assign(got,ord);
 else d.receipts.forEach(r=>r.lines.forEach(l=>{got[l.code]=R2((got[l.code]||0)+l.qty)}));
 const items=[...new Set([...Object.keys(ord),...Object.keys(got)])].map(c=>{
  const l0=d.lines.find(l=>l.code===c);
  return{code:c,desc:l0?l0.desc:(P(c).description||''),ord:ord[c]||0,got:got[c]||0,pend:Math.max(0,R2((ord[c]||0)-(got[c]||0)))}});
 const to=items.reduce((a,x)=>a+x.ord,0),tg=items.reduce((a,x)=>a+Math.min(x.got,x.ord),0),
  st=tg<=0.0001?'none':items.every(x=>x.pend<=0.0001)?'full':'partial';
 return{items,to,tg,st}}

/* receipts are read together with the rest of the data */
const _load8=load;
load=async function(){
 const ok=await _load8();if(!ok)return false;
 const r=await pageAll('receipts','*,receipt_lines(*)');
 if(r.error){
  S.grOff=true;S.docs.forEach(d=>{d.receipts=null});
  if(!S.grWarned){S.grWarned=1;toast('Goods Received is not set up yet (run the SQL). Purchases count as received.')}
  return true}
 S.grOff=false;
 const by={};
 r.data.forEach(x=>(by[x.document_id]=by[x.document_id]||[]).push({id:x.id,recv_date:x.recv_date,note:x.note,created_at:x.created_at,lines:x.receipt_lines.map(l=>({code:l.product_code,qty:+l.qty}))}));
 S.docs.forEach(d=>{if(d.doc_type==='purchase')d.receipts=by[d.id]||[]});
 return true};

/* stock: a purchase adds stock only for the goods that have been received */
stock=function(){
 const s={},a=(c,l,q)=>{(s[c]=s[c]||{})[l]=(s[c][l]||0)+q},A=ALW();
 S.docs.forEach(d=>{
  if(d.doc_type==='transfer')d.lines.forEach(l=>{a(l.code,d.location_id,-l.qty);a(l.code,d.to_location_id,l.qty)});
  else if(d.doc_type==='purchase'&&d.receipts!=null)d.receipts.forEach(r=>r.lines.forEach(l=>a(l.code,d.location_id,l.qty)));
  else d.lines.forEach(l=>a(l.code,d.location_id,D[d.doc_type].s*l.qty))});
 if(A&&RS){for(const c in s)for(const l in s[c])if(!A.has(l))delete s[c][l];RS.forEach(r=>{(s[r.r_code]=s[r.r_code]||{})[r.r_loc]=+r.r_qty})}
 return s};

async function grInsert(docId,date,note,lines){
 const r=await sb.from('receipts').insert({tenant_id:T,document_id:docId,recv_date:date,note:note||null}).select().single();
 if(r.error)throw r.error;
 const l=await sb.from('receipt_lines').insert(lines.map(x=>({tenant_id:T,receipt_id:r.data.id,product_code:x.code,qty:x.qty})));
 if(l.error){await sb.from('receipts').delete().eq('id',r.data.id);throw l.error}
 return r.data}

/* ---------- purchase form: "Receive all goods now" ---------- */
const _docForm8=docForm;
docForm=function(type,id){
 const r=_docForm8(type,id);
 if(type!=='purchase'||S.grOff||!r[1]||r[1].indexOf('id="df_no"')<0)return r;
 const mark='<div class="field"><label>Note</label>';
 if(!id){
  CUR.recvAll=true;
  r[1]=r[1].replace(mark,'<div class="field"><label>Goods</label><label style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px;height:38px"><input type="checkbox" checked onchange="CUR.recvAll=this.checked"> Receive all goods now</label></div>'+mark)}
 else{
  const d0=S.docs.find(x=>x.id===id);
  if(d0){const gi=grInfo(d0);r[1]=r[1].replace(mark,'<div class="field"><label>Goods</label><input class="input" readonly value="Received '+fmt(gi.tg)+' of '+fmt(gi.to)+'"></div>'+mark)}}
 return r};

/* ---------- save (copy of the normal save, plus goods checks and the receipt) ---------- */
docSave=async function(){
 if(SAVING)return;
 const t=CUR.doc_type,c=DT[t],isT=t==='transfer',isP=!!c.pay,isPu=t==='purchase'&&!S.grOff;
 if(!CUR.lines.length)return toast('Add at least one item');
 if(!CUR.doc_date)return toast('Choose a date');
 if(!CUR.location_id)return toast('Choose a location');
 if(isT){
  if(!CUR.to_location_id)return toast('Choose the destination');
  if(CUR.to_location_id===CUR.location_id)return toast('From and To must be different')}
 else if(!CUR.partner)return toast('Choose a '+c.pl.toLowerCase()+' (add one first if the list is empty)');
 const total=R2(dt(CUR)),old=CUR.id?S.docs.find(d=>d.id===CUR.id):null;
 if(CUR.id&&isP&&R2(CUR.paid)>total+0.005)return toast('The total is less than the amount already paid ('+fmt(CUR.paid)+' Ks). Change the payment first.');
 if(isPu&&old){
  const gi=grInfo(old);
  if(gi.tg>0){
   if(CUR.location_id!==old.location_id)return toast('Goods have already been received on this purchase, so its location cannot be changed.');
   const now={};CUR.lines.forEach(l=>{now[l.code]=R2((now[l.code]||0)+l.qty)});
   for(const x of gi.items)if(x.got>0&&(now[x.code]||0)<x.got-0.0001)
    return toast(x.code+': '+fmt(x.got)+' already received, so the quantity cannot go below that. Delete the receipt first.')}}
 const keep=S.docs,tmp={...CUR,doc_no:CUR.doc_no||'~new'};
 if(isPu&&old)tmp.receipts=old.receipts;
 S.docs=[...keep.filter(d=>d.id!==CUR.id),tmp];const bad=neg();S.docs=keep;
 if(bad)return toast('Not enough stock: '+bad);
 SAVING=true;const btn=$('#dsave');if(btn)btn.disabled=true;
 let warn='';
 try{
  const row={tenant_id:T,doc_type:t,doc_date:CUR.doc_date,partner:isT?null:CUR.partner,location_id:CUR.location_id,to_location_id:isT?CUR.to_location_id:null,note:CUR.note||null};
  const lrows=id=>CUR.lines.map(l=>({tenant_id:T,document_id:id,product_code:l.code,description:l.desc,qty:l.qty,price:isT?0:l.price,cost:l.cost||0}));
  let id=CUR.id,no=CUR.doc_no;
  if(id){
   const u=await sb.from('documents').update(row).eq('id',id).select('id');
   if(u.error)throw u.error;
   if(!u.data.length)throw new Error('You do not have permission to do this.');
   const ol=await sb.from('document_lines').select('id').eq('document_id',id);if(ol.error)throw ol.error;
   const ins=await sb.from('document_lines').insert(lrows(id));if(ins.error)throw ins.error;
   if(ol.data.length){const del=await sb.from('document_lines').delete().in('id',ol.data.map(x=>x.id));if(del.error)throw del.error}
  }else{
   const r=await sb.from('documents').insert({...row,doc_no:''}).select().single();if(r.error)throw r.error;
   id=r.data.id;no=r.data.doc_no;
   const ins=await sb.from('document_lines').insert(lrows(id));
   if(ins.error){await sb.from('documents').delete().eq('id',id);throw ins.error}
   if(isP&&CUR.pay&&CUR.pay!=='Credit'&&total>0){
    const py=await sb.from('payments').insert({tenant_id:T,document_id:id,pay_date:CUR.doc_date,amount:total,method:CUR.pay,note:'Paid at invoice'});
    if(py.error){await sb.from('documents').delete().eq('id',id);throw py.error}}
   if(isPu&&CUR.recvAll!==false){
    try{await grInsert(id,CUR.doc_date,'Received with the invoice',CUR.lines.map(l=>({code:l.code,qty:l.qty})))}
    catch(e){warn=' (goods could not be marked as received: '+dErr(e)+')'}}
  }
  if(!await load())throw new Error('Saved, but the data could not be reloaded. Please refresh.');
  const doc=S.docs.find(d=>d.id===id);
  toast('Saved '+no+warn);
  if(doc&&confirm('Saved '+no+'. Print now?'))printDoc(doc);
  go(t+'-r');
 }catch(e){toast(dErr(e))}
 finally{SAVING=false;const b=$('#dsave');if(b)b.disabled=false}};

/* ---------- purchase records: goods column, goods filter ---------- */
function grDecorate(){
 const tb=document.querySelector('#r_tbl table');if(!tb)return;
 const hr=tb.querySelector('thead tr');if(!hr)return;
 const th=document.createElement('th');th.textContent='Goods';hr.insertBefore(th,hr.lastElementChild);
 tb.querySelectorAll('tbody tr').forEach(tr=>{
  const tds=tr.children;if(tds.length<5)return;
  const no=tds[0].textContent.trim(),d=S.docs.find(x=>x.doc_type==='purchase'&&x.doc_no===no);if(!d)return;
  const gi=grInfo(d),td=document.createElement('td'),act=tds[tds.length-1];
  td.innerHTML=grBadge(gi.st)+' <span class="mu">'+fmt(gi.tg)+' / '+fmt(gi.to)+'</span>';
  tr.insertBefore(td,act);
  act.insertAdjacentHTML('afterbegin','<button class="btn sm '+(gi.st==='full'?'':'ok')+'" onclick="grOpen(\''+d.id+'\')">'+(gi.st==='full'||!grCan()?'Goods':'Receive')+'</button>')})}
const _rd8=recDraw;
recDraw=function(){_rd8();if(RT==='purchase'&&!S.grOff)grDecorate()};
const _rr8=recRows;
recRows=function(){const rows=_rr8();return(RT==='purchase'&&!S.grOff&&GRF)?rows.filter(x=>grInfo(x.d).st===GRF):rows};
const _rp8=recPage;
recPage=function(type){
 GRF='';const r=_rp8(type);
 if(type==='purchase'&&!S.grOff)r[1]=r[1].replace('<div class="field"><label>&nbsp;</label><button class="btn" onclick="go(','<div class="field"><label>Goods</label><select class="input" onchange="GRF=this.value;recDraw()"><option value="">All</option><option value="none">Not received</option><option value="partial">Partly received</option><option value="full">Received</option></select></div><div class="field"><label>&nbsp;</label><button class="btn" onclick="go(');
 return r};

/* View window of a purchase shows the goods status */
const _vd8=viewDoc;
viewDoc=function(id){
 _vd8(id);
 const d=S.docs.find(x=>x.id===id);if(!d||d.doc_type!=='purchase'||S.grOff)return;
 const gi=grInfo(d),m=document.querySelector('#modal .mact');if(!m)return;
 m.insertAdjacentHTML('beforebegin','<div class="row"><span>Goods</span><b>'+grBadge(gi.st)+' '+fmt(gi.tg)+' of '+fmt(gi.to)+' received</b></div>');
 m.insertAdjacentHTML('afterbegin','<button class="btn" onclick="grOpen(\''+id+'\')">Goods received</button>')};

/* ---------- the goods window: ordered, received, pending, new receipt, history ---------- */
function grOpen(id){
 const d=S.docs.find(x=>x.id===id);if(!d)return;
 const gi=grInfo(d),W=grCan(),ce=canEd(),open=W&&gi.st!=='full';
 GR={id,items:gi.items.map(x=>({...x}))};
 const rcs=(d.receipts||[]).slice().sort((a,b)=>a.recv_date.localeCompare(b.recv_date)||(a.created_at||'').localeCompare(b.created_at||''));
 openModal(`<div class="mbox" style="max-width:700px"><h3>${esc(d.doc_no)} ${grBadge(gi.st)}</h3>
 <p class="mu" style="margin-bottom:8px">${esc(d.partner||'')} · ${esc(ln(d.location_id))} · ordered ${d.doc_date}</p>
 <div class="tw"><table><thead><tr><th>Code</th><th>Description</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Pending</th>${open?'<th class="num">Receive now</th>':''}</tr></thead><tbody>
 ${GR.items.map((x,i)=>`<tr><td>${esc(x.code)}</td><td style="white-space:normal">${esc(x.desc)}</td><td class="num">${fmt(x.ord)}</td><td class="num">${fmt(x.got)}</td><td class="num">${fmt(x.pend)}</td>${open?`<td class="num"><input class="input" style="width:92px;text-align:right" type="number" min="0" step="any" inputmode="decimal" id="gr_q${i}" value="0" ${x.pend>0.0001?'':'disabled'}></td>`:''}</tr>`).join('')}</tbody></table></div>
 ${open?`<div class="hg" style="margin-top:12px"><div class="field"><label>Received on</label><input class="input" type="date" id="gr_d" value="${today()}"></div><div class="field"><label>Note (delivery, driver...)</label><input class="input" id="gr_n"></div></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" onclick="grFill()">Fill all remaining</button></div>`:''}
 <h4 style="margin:16px 0 6px;font-size:13px">Receipts</h4>
 <div class="tw"><table><thead><tr><th>Date</th><th>Items</th><th>Note</th><th></th></tr></thead><tbody>
 ${rcs.map(r=>`<tr><td>${r.recv_date}</td><td style="white-space:normal">${esc(r.lines.map(l=>l.code+' × '+fmt(l.qty)).join(', '))}</td><td style="white-space:normal">${esc(r.note||'')}</td><td class="act"><button class="btn sm" onclick="grPrint('${id}','${r.id}')">Print</button>${ce&&W?`<button class="btn sm d" onclick="grDel('${id}','${r.id}')">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nothing received yet.</td></tr>'}</tbody></table></div>
 <div class="mact" style="margin-top:12px"><button class="btn" onclick="grClose()">Close</button>${open?`<button class="btn" onclick="grSave(true)">Receive all remaining</button><button class="btn ok" onclick="grSave(false)">Save received goods</button>`:''}</div></div>`)}
function grClose(){mclose();if(typeof RDRAW==='function')RDRAW()}
function grFill(){GR.items.forEach((x,i)=>{const e=$('#gr_q'+i);if(e&&!e.disabled)e.value=x.pend})}
async function grSave(all){
 if(GRB||!GR)return;
 const d=S.docs.find(x=>x.id===GR.id);if(!d)return;
 if(!grCan())return toast('You do not have permission to receive goods.');
 const date=($('#gr_d')?$('#gr_d').value:'')||today(),lines=[];
 for(let i=0;i<GR.items.length;i++){
  const x=GR.items[i];if(x.pend<=0.0001)continue;
  const q=all?x.pend:R2(($('#gr_q'+i)||{}).value);
  if(!(q>=0))return toast('Check the quantity of '+x.code);
  if(q>x.pend+0.0001)return toast(x.code+': only '+fmt(x.pend)+' is still pending');
  if(q>0)lines.push({code:x.code,qty:R2(q)})}
 if(!lines.length)return toast('Enter the quantity received');
 if(all&&!confirm('Mark all remaining goods of '+d.doc_no+' as received?'))return;
 GRB=true;
 try{await grInsert(d.id,date,$('#gr_n')?$('#gr_n').value.trim():'',lines);await load();toast('Saved');grOpen(d.id)}
 catch(e){toast(dErr(e))}
 finally{GRB=false}}
async function grDel(did,rid){
 const d=S.docs.find(x=>x.id===did);if(!d||!canEd()||!grCan())return;
 if(!confirm('Delete this receipt? Stock will go down by the quantities received.'))return;
 const keep=d.receipts;d.receipts=keep.filter(r=>r.id!==rid);const bad=neg();d.receipts=keep;
 if(bad)return toast('Cannot delete, stock would go negative: '+bad);
 const {data,error}=await sb.from('receipts').delete().eq('id',rid).select('id');
 if(error)return toast(dErr(error));
 if(!data.length)return toast('You do not have permission to delete this.');
 await load();toast('Deleted');grOpen(did)}
function grPrint(did,rid){
 const d=S.docs.find(x=>x.id===did),r=d&&(d.receipts||[]).find(x=>x.id===rid);if(!r)return;
 const st=pvS(),dsc=c=>(d.lines.find(x=>x.code===c)||{}).desc||(P(c).description||'');
 pvPrintModel({kind:'grn',title:'Goods Received Note',
  meta:[['Purchase no',d.doc_no],['Received on',r.recv_date],['Supplier',d.partner||'-'],['Location',ln(d.location_id)]],more:[],
  cols:[{h:'#',w:'26px'},{h:'Code',w:'90px'},{h:'Description',w:'1fr'},{h:'Qty received',w:'90px',r:1}],
  rows:r.lines.map((l,i)=>[i+1,l.code,dsc(l.code),fmt(l.qty)]),
  lines:r.lines.map(l=>({code:l.code,desc:dsc(l.code),qty:l.qty,price:null})),
  totals:[],pays:[],note:r.note||'',bank:false,sig:['Received by','Delivered by']},st.paper,st)}

/* ---------- Pending Deliveries ---------- */
function grPendDraw(){
 const el=$('#gp_t');if(!el)return;
 const q=($('#gp_q')?$('#gp_q').value:'').trim().toLowerCase(),W=grCan(),
  rows=S.docs.filter(d=>d.doc_type==='purchase'&&(!LF||d.location_id===LF)).map(d=>({d,gi:grInfo(d)})).filter(x=>x.gi.st!=='full')
   .filter(x=>!q||((x.d.doc_no||'')+' '+(x.d.partner||'')+' '+x.gi.items.map(i=>i.code+' '+i.desc).join(' ')).toLowerCase().includes(q))
   .sort((a,b)=>a.d.doc_date.localeCompare(b.d.doc_date));
 $('#gp_n').textContent=rows.length+' purchases waiting for goods';
 el.innerHTML=`<table><thead><tr><th>Purchase</th><th>Ordered on</th><th>Supplier</th><th>Location</th><th>Waiting</th><th>Still to arrive</th><th>Status</th><th></th></tr></thead><tbody>
 ${rows.slice(0,300).map(({d,gi})=>{const days=Math.floor((Date.now()-new Date(d.doc_date))/864e5);
  return`<tr><td><b>${esc(d.doc_no)}</b></td><td>${d.doc_date}</td><td>${esc(d.partner||'')}</td><td>${esc(ln(d.location_id))}</td><td><span class="badge ${days>14?'bad':'ok'}">${days}d</span></td><td style="white-space:normal;min-width:180px">${esc(gi.items.filter(x=>x.pend>0.0001).map(x=>x.code+' × '+fmt(x.pend)).join(', '))}</td><td>${grBadge(gi.st)}</td><td class="act"><button class="btn sm ${W?'ok':''}" onclick="grOpen('${d.id}')">${W?'Receive':'View'}</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Nothing is waiting for delivery.</td></tr>'}</tbody></table>`}
V.pending=()=>{
 if(S.grOff)return['Pending Deliveries','<div class="empty">Goods Received is not set up yet. Run the SQL for it first.</div>'];
 return['Pending Deliveries',`<div class="page-head"><b id="gp_n"></b><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">${locSelHtml()}<input class="input" style="width:220px" id="gp_q" placeholder="Search supplier, product..." oninput="grPendDraw()"></div></div><div class="card"><div class="tw" id="gp_t"></div></div>`,()=>{RDRAW=grPendDraw;grPendDraw()}]};
addNav('Purchase','pending','Pending Deliveries','purchase');
NAVORD.splice(NAVORD.indexOf('purchase-r')+1,0,'pending');sortNav();

/* ---------- Excel sheets ---------- */
SH['Goods Received']=()=>S.grOff?[['Goods Received is not set up yet']]:[['Purchase no','Supplier','Location','Received on','Code','Description','Qty received','Note'],
 ...xD('purchase',false).flatMap(d=>(d.receipts||[]).filter(r=>xIn({doc_date:r.recv_date})).flatMap(r=>r.lines.map(l=>[d.doc_no,d.partner,ln(d.location_id),r.recv_date,l.code,(d.lines.find(x=>x.code===l.code)||{}).desc||'',l.qty,r.note||''])))];
SH['Pending Goods']=()=>S.grOff?[['Goods Received is not set up yet']]:[['Purchase no','Date','Supplier','Location','Code','Description','Ordered','Received','Pending','Days waiting'],
 ...xD('purchase',false).flatMap(d=>grInfo(d).items.filter(x=>x.pend>0.0001).map(x=>[d.doc_no,d.doc_date,d.partner,ln(d.location_id),x.code,x.desc,x.ord,x.got,x.pend,xAge(d)]))];
REP.push(['Goods Received','Goods received, delivery by delivery'],['Pending Goods','Ordered goods that have not arrived yet']);

/* ---------- backup and restore carry the receipts ---------- */
xBackup=function(){
 const o={app:'retailpro',version:3,shop:me().name||'',exported_at:new Date().toISOString(),
  locations:S.locations,products:S.products,customers:S.customers,suppliers:S.suppliers,expenses:S.expenses,expense_categories:S.xcats||[],
  documents:S.docs.map(d=>({id:d.id,doc_type:d.doc_type,doc_no:d.doc_no,doc_date:d.doc_date,partner:d.partner,location_id:d.location_id,to_location_id:d.to_location_id,note:d.note,reason:d.reason,
   lines:d.lines.map(l=>({code:l.code,desc:l.desc,qty:l.qty,price:l.price,cost:l.cost})),
   payments:(d.payments||[]).map(p=>({pay_date:p.pay_date,amount:p.amount,method:p.method,note:p.note,receipt_id:p.receipt_id})),
   ...(d.doc_type==='purchase'&&!S.grOff?{receipts:(d.receipts||[]).map(r=>({recv_date:r.recv_date,note:r.note,lines:r.lines}))}:{})}))};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));
 a.download='retailpro_backup_'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
 try{localStorage.setItem('lastExport',new Date().toLocaleString())}catch(e){}toast('Backup downloaded')};
const _rs8=rsRun;
rsRun=async function(){
 const snap=RB;await _rs8();
 if(!snap||S.grOff)return;
 const pu=snap.docs.filter(d=>d.doc_type==='purchase');if(!pu.length)return;
 try{
  let n=0;
  for(const bd of pu){
   const d=S.docs.find(x=>x.doc_type==='purchase'&&x.doc_no===bd.doc_no);
   if(!d||(d.receipts||[]).length)continue;
   const rs=Array.isArray(bd.receipts)?bd.receipts:[{recv_date:bd.doc_date,note:'Restored',lines:(bd.lines||[]).map(l=>({code:l.code,qty:l.qty}))}];
   for(const r of rs)if(r.lines&&r.lines.length){await grInsert(d.id,r.recv_date||bd.doc_date,r.note,r.lines);n++}}
  if(n){await load();toast(n+' goods receipt(s) restored')}
 }catch(e){toast('Documents restored, but goods receipts could not be restored: '+dErr(e))}};
