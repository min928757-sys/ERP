'use strict';
/* Stage 9: Sale deliveries. Stock goes down when goods are handed over, not when the invoice is saved. */
S.dlOff=false;
const dlCan=()=>!readOnly()&&can('sale');
const dlBadge=s=>s==='full'?'<span class="badge ok">Delivered</span>':s==='partial'?'<span class="badge warn">Partly delivered</span>':'<span class="badge bad">Not delivered</span>';
let DL=null,DLB=false,DLF='';

/* ordered / delivered / pending for one sale */
function dlInfo(d){
 const ord={},got={};
 d.lines.forEach(l=>{ord[l.code]=R2((ord[l.code]||0)+l.qty)});
 if(S.dlOff||d.deliveries==null)Object.assign(got,ord);
 else d.deliveries.forEach(r=>r.lines.forEach(l=>{got[l.code]=R2((got[l.code]||0)+l.qty)}));
 const items=[...new Set([...Object.keys(ord),...Object.keys(got)])].map(c=>{
  const l0=d.lines.find(l=>l.code===c);
  return{code:c,desc:l0?l0.desc:(P(c).description||''),ord:ord[c]||0,got:got[c]||0,pend:Math.max(0,R2((ord[c]||0)-(got[c]||0)))}});
 const to=items.reduce((a,x)=>a+x.ord,0),tg=items.reduce((a,x)=>a+Math.min(x.got,x.ord),0),
  st=tg<=0.0001?'none':items.every(x=>x.pend<=0.0001)?'full':'partial';
 return{items,to,tg,st}}

/* deliveries are read together with the rest of the data */
const _load9=load;
load=async function(){
 const ok=await _load9();if(!ok)return false;
 const r=await pageAll('deliveries','*,delivery_lines(*)');
 if(r.error){
  S.dlOff=true;S.docs.forEach(d=>{if(d.doc_type==='sale')d.deliveries=null});
  if(!S.dlWarned){S.dlWarned=1;toast('Sale deliveries are not set up yet (run the SQL). Sales count as delivered.')}
  return true}
 S.dlOff=false;
 const by={};
 r.data.forEach(x=>(by[x.document_id]=by[x.document_id]||[]).push({id:x.id,deliver_date:x.deliver_date,note:x.note,created_at:x.created_at,lines:x.delivery_lines.map(l=>({code:l.product_code,qty:+l.qty}))}));
 S.docs.forEach(d=>{if(d.doc_type==='sale')d.deliveries=by[d.id]||[]});
 return true};

/* stock: purchases add when received, sales take away when delivered */
stock=function(){
 const s={},a=(c,l,q)=>{(s[c]=s[c]||{})[l]=(s[c][l]||0)+q},A=ALW();
 S.docs.forEach(d=>{
  if(d.doc_type==='transfer')d.lines.forEach(l=>{a(l.code,d.location_id,-l.qty);a(l.code,d.to_location_id,l.qty)});
  else if(d.doc_type==='purchase'&&d.receipts!=null)d.receipts.forEach(r=>r.lines.forEach(l=>a(l.code,d.location_id,l.qty)));
  else if(d.doc_type==='sale'&&d.deliveries!=null)d.deliveries.forEach(r=>r.lines.forEach(l=>a(l.code,d.location_id,-l.qty)));
  else d.lines.forEach(l=>a(l.code,d.location_id,D[d.doc_type].s*l.qty))});
 if(A&&RS){for(const c in s)for(const l in s[c])if(!A.has(l))delete s[c][l];RS.forEach(r=>{(s[r.r_code]=s[r.r_code]||{})[r.r_loc]=+r.r_qty})}
 return s};

async function dlInsert(docId,date,note,lines){
 const r=await sb.from('deliveries').insert({tenant_id:T,document_id:docId,deliver_date:date,note:note||null}).select().single();
 if(r.error)throw r.error;
 const l=await sb.from('delivery_lines').insert(lines.map(x=>({tenant_id:T,delivery_id:r.data.id,product_code:x.code,qty:x.qty})));
 if(l.error){await sb.from('deliveries').delete().eq('id',r.data.id);throw l.error}
 return r.data}

/* ---------- sale form: "Deliver all goods now" ---------- */
const _docForm9=docForm;
docForm=function(type,id){
 const r=_docForm9(type,id);
 if(type!=='sale'||S.dlOff||!r[1]||r[1].indexOf('id="df_no"')<0)return r;
 const mark='<div class="field"><label>Note</label>';
 if(!id){
  CUR.deliverAll=true;
  r[1]=r[1].replace(mark,'<div class="field"><label>Goods</label><label style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px;height:38px"><input type="checkbox" checked onchange="CUR.deliverAll=this.checked"> Deliver all goods now</label></div>'+mark)}
 else{
  const d0=S.docs.find(x=>x.id===id);
  if(d0){const di=dlInfo(d0);r[1]=r[1].replace(mark,'<div class="field"><label>Goods</label><input class="input" readonly value="Delivered '+fmt(di.tg)+' of '+fmt(di.to)+'"></div>'+mark)}}
 return r};
const _docPick9=docPick;
docPick=function(){
 _docPick9();
 if(!CUR||CUR.doc_type!=='sale'||S.dlOff)return;
 const p=pByCode($('#e_code').value),av=$('#e_av');
 if(!p||!av||!CUR.location_id)return;
 let pend=0;
 S.docs.forEach(d=>{if(d.doc_type==='sale'&&d.location_id===CUR.location_id&&d.id!==CUR.id){const x=dlInfo(d).items.find(i=>i.code===p.code);if(x)pend+=x.pend}});
 if(pend>0.0001)av.textContent=av.textContent.replace(')',', promised to other customers: '+fmt(pend)+')')};

/* ---------- save (the normal save, plus the goods checks for purchases and sales) ---------- */
docSave=async function(){
 if(SAVING)return;
 const t=CUR.doc_type,c=DT[t],isT=t==='transfer',isP=!!c.pay,isPu=t==='purchase'&&!S.grOff,isSa=t==='sale'&&!S.dlOff;
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
 if(isSa&&old){
  const di=dlInfo(old);
  if(di.tg>0){
   if(CUR.location_id!==old.location_id)return toast('Goods have already been delivered on this sale, so its location cannot be changed.');
   const now={};CUR.lines.forEach(l=>{now[l.code]=R2((now[l.code]||0)+l.qty)});
   for(const x of di.items)if(x.got>0&&(now[x.code]||0)<x.got-0.0001)
    return toast(x.code+': '+fmt(x.got)+' already delivered, so the quantity cannot go below that. Delete the delivery first.')}}
 const keep=S.docs,tmp={...CUR,doc_no:CUR.doc_no||'~new'};
 if(isPu&&old)tmp.receipts=old.receipts;
 if(isSa)tmp.deliveries=old?old.deliveries:(CUR.deliverAll!==false?[{lines:CUR.lines.map(l=>({code:l.code,qty:l.qty}))}]:[]);
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
   if(isSa&&CUR.deliverAll!==false){
    try{await dlInsert(id,CUR.doc_date,'Delivered with the invoice',CUR.lines.map(l=>({code:l.code,qty:l.qty})))}
    catch(e){warn=' (goods could not be marked as delivered: '+dErr(e)+')'}}
  }
  if(!await load())throw new Error('Saved, but the data could not be reloaded. Please refresh.');
  const doc=S.docs.find(d=>d.id===id);
  toast('Saved '+no+warn);
  if(doc&&confirm('Saved '+no+'. Print now?'))printDoc(doc);
  go(t+'-r');
 }catch(e){toast(dErr(e))}
 finally{SAVING=false;const b=$('#dsave');if(b)b.disabled=false}};

/* ---------- sale records: goods column and goods filter ---------- */
function dlDecorate(){
 const tb=document.querySelector('#r_tbl table');if(!tb)return;
 const hr=tb.querySelector('thead tr');if(!hr)return;
 const th=document.createElement('th');th.textContent='Goods';hr.insertBefore(th,hr.lastElementChild);
 tb.querySelectorAll('tbody tr').forEach(tr=>{
  const tds=tr.children;if(tds.length<5)return;
  const no=tds[0].textContent.trim(),d=S.docs.find(x=>x.doc_type==='sale'&&x.doc_no===no);if(!d)return;
  const di=dlInfo(d),td=document.createElement('td'),act=tds[tds.length-1];
  td.innerHTML=dlBadge(di.st)+' <span class="mu">'+fmt(di.tg)+' / '+fmt(di.to)+'</span>';
  tr.insertBefore(td,act);
  act.insertAdjacentHTML('afterbegin','<button class="btn sm '+(di.st==='full'?'':'ok')+'" onclick="dlOpen(\''+d.id+'\')">'+(di.st==='full'||!dlCan()?'Goods':'Deliver')+'</button>')})}
const _rd9=recDraw;
recDraw=function(){_rd9();if(RT==='sale'&&!S.dlOff)dlDecorate()};
const _rr9=recRows;
recRows=function(){const rows=_rr9();return(RT==='sale'&&!S.dlOff&&DLF)?rows.filter(x=>dlInfo(x.d).st===DLF):rows};
const _rp9=recPage;
recPage=function(type){
 DLF='';const r=_rp9(type);
 if(type==='sale'&&!S.dlOff)r[1]=r[1].replace('<div class="field"><label>&nbsp;</label><button class="btn" onclick="go(','<div class="field"><label>Goods</label><select class="input" onchange="DLF=this.value;recDraw()"><option value="">All</option><option value="none">Not delivered</option><option value="partial">Partly delivered</option><option value="full">Delivered</option></select></div><div class="field"><label>&nbsp;</label><button class="btn" onclick="go(');
 return r};
const _vd9=viewDoc;
viewDoc=function(id){
 _vd9(id);
 const d=S.docs.find(x=>x.id===id);if(!d||d.doc_type!=='sale'||S.dlOff)return;
 const di=dlInfo(d),m=document.querySelector('#modal .mact');if(!m)return;
 m.insertAdjacentHTML('beforebegin','<div class="row"><span>Goods</span><b>'+dlBadge(di.st)+' '+fmt(di.tg)+' of '+fmt(di.to)+' delivered</b></div>');
 m.insertAdjacentHTML('afterbegin','<button class="btn" onclick="dlOpen(\''+id+'\')">Deliveries</button>')};

/* ---------- the delivery window ---------- */
function dlOpen(id){
 const d=S.docs.find(x=>x.id===id);if(!d)return;
 const di=dlInfo(d),W=dlCan(),ce=canEd(),open=W&&di.st!=='full',s=stock();
 DL={id,items:di.items.map(x=>({...x,have:(s[x.code]||{})[d.location_id]||0}))};
 const rcs=(d.deliveries||[]).slice().sort((a,b)=>a.deliver_date.localeCompare(b.deliver_date)||(a.created_at||'').localeCompare(b.created_at||''));
 openModal(`<div class="mbox" style="max-width:720px"><h3>${esc(d.doc_no)} ${dlBadge(di.st)}</h3>
 <p class="mu" style="margin-bottom:8px">${esc(d.partner||'')} · ${esc(ln(d.location_id))} · sold ${d.doc_date}</p>
 <div class="tw"><table><thead><tr><th>Code</th><th>Description</th><th class="num">Sold</th><th class="num">Delivered</th><th class="num">Pending</th>${open?'<th class="num">In stock</th><th class="num">Deliver now</th>':''}</tr></thead><tbody>
 ${DL.items.map((x,i)=>`<tr><td>${esc(x.code)}</td><td style="white-space:normal">${esc(x.desc)}</td><td class="num">${fmt(x.ord)}</td><td class="num">${fmt(x.got)}</td><td class="num">${fmt(x.pend)}</td>${open?`<td class="num">${fmt(x.have)}</td><td class="num"><input class="input" style="width:92px;text-align:right" type="number" min="0" step="any" inputmode="decimal" id="dl_q${i}" value="0" ${x.pend>0.0001?'':'disabled'}></td>`:''}</tr>`).join('')}</tbody></table></div>
 ${open?`<div class="hg" style="margin-top:12px"><div class="field"><label>Delivered on</label><input class="input" type="date" id="dl_d" value="${today()}"></div><div class="field"><label>Note (driver, vehicle...)</label><input class="input" id="dl_n"></div></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" onclick="dlFill()">Fill what is in stock</button></div>`:''}
 <h4 style="margin:16px 0 6px;font-size:13px">Deliveries</h4>
 <div class="tw"><table><thead><tr><th>Date</th><th>Items</th><th>Note</th><th></th></tr></thead><tbody>
 ${rcs.map(r=>`<tr><td>${r.deliver_date}</td><td style="white-space:normal">${esc(r.lines.map(l=>l.code+' × '+fmt(l.qty)).join(', '))}</td><td style="white-space:normal">${esc(r.note||'')}</td><td class="act"><button class="btn sm" onclick="dlPrint('${id}','${r.id}')">Print</button>${ce&&W?`<button class="btn sm d" onclick="dlDel('${id}','${r.id}')">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nothing delivered yet.</td></tr>'}</tbody></table></div>
 <div class="mact" style="margin-top:12px"><button class="btn" onclick="dlClose()">Close</button>${open?`<button class="btn" onclick="dlSave(true)">Deliver all remaining</button><button class="btn ok" onclick="dlSave(false)">Save delivered goods</button>`:''}</div></div>`)}
function dlClose(){mclose();if(typeof RDRAW==='function')RDRAW()}
function dlFill(){DL.items.forEach((x,i)=>{const e=$('#dl_q'+i);if(e&&!e.disabled)e.value=Math.max(0,Math.min(x.pend,x.have))})}
async function dlSave(all){
 if(DLB||!DL)return;
 const d=S.docs.find(x=>x.id===DL.id);if(!d)return;
 if(!dlCan())return toast('You do not have permission to deliver goods.');
 const date=($('#dl_d')?$('#dl_d').value:'')||today(),lines=[];
 for(let i=0;i<DL.items.length;i++){
  const x=DL.items[i];if(x.pend<=0.0001)continue;
  const q=all?x.pend:R2(($('#dl_q'+i)||{}).value);
  if(!(q>=0))return toast('Check the quantity of '+x.code);
  if(q>x.pend+0.0001)return toast(x.code+': only '+fmt(x.pend)+' is still pending');
  if(q>0)lines.push({code:x.code,qty:R2(q)})}
 if(!lines.length)return toast('Enter the quantity delivered');
 if(all&&!confirm('Mark all remaining goods of '+d.doc_no+' as delivered?'))return;
 const keep=d.deliveries;d.deliveries=[...(keep||[]),{lines:lines.map(x=>({code:x.code,qty:x.qty}))}];const bad=neg();d.deliveries=keep;
 if(bad)return toast('Not enough stock: '+bad);
 DLB=true;
 try{await dlInsert(d.id,date,$('#dl_n')?$('#dl_n').value.trim():'',lines);await load();toast('Saved');dlOpen(d.id)}
 catch(e){toast(dErr(e))}
 finally{DLB=false}}
async function dlDel(did,rid){
 const d=S.docs.find(x=>x.id===did);if(!d||!canEd()||!dlCan())return;
 if(!confirm('Delete this delivery? Stock will go back up by the quantities delivered.'))return;
 const {data,error}=await sb.from('deliveries').delete().eq('id',rid).select('id');
 if(error)return toast(dErr(error));
 if(!data.length)return toast('You do not have permission to delete this.');
 await load();toast('Deleted');dlOpen(did)}
function dlPrint(did,rid){
 const d=S.docs.find(x=>x.id===did),r=d&&(d.deliveries||[]).find(x=>x.id===rid);if(!r)return;
 const st=pvS(),dsc=c=>(d.lines.find(x=>x.code===c)||{}).desc||(P(c).description||'');
 pvPrintModel({kind:'dn',title:'Delivery Note',
  meta:[['Sale no',d.doc_no],['Delivered on',r.deliver_date],['Customer',d.partner||'-'],['Location',ln(d.location_id)]],more:[],
  cols:[{h:'#',w:'26px'},{h:'Code',w:'90px'},{h:'Description',w:'1fr'},{h:'Qty delivered',w:'96px',r:1}],
  rows:r.lines.map((l,i)=>[i+1,l.code,dsc(l.code),fmt(l.qty)]),
  lines:r.lines.map(l=>({code:l.code,desc:dsc(l.code),qty:l.qty,price:null})),
  totals:[],pays:[],note:r.note||'',bank:false,sig:['Delivered by','Received by']},st.paper,st)}

/* ---------- Pending Deliveries (sales) ---------- */
function dlPendDraw(){
 const el=$('#dp_t');if(!el)return;
 const q=($('#dp_q')?$('#dp_q').value:'').trim().toLowerCase(),W=dlCan(),s=stock(),
  rows=S.docs.filter(d=>d.doc_type==='sale'&&(!LF||d.location_id===LF)).map(d=>({d,di:dlInfo(d)})).filter(x=>x.di.st!=='full')
   .filter(x=>!q||((x.d.doc_no||'')+' '+(x.d.partner||'')+' '+x.di.items.map(i=>i.code+' '+i.desc).join(' ')).toLowerCase().includes(q))
   .sort((a,b)=>a.d.doc_date.localeCompare(b.d.doc_date));
 $('#dp_n').textContent=rows.length+' sales waiting for delivery';
 el.innerHTML=`<table><thead><tr><th>Sale</th><th>Sold on</th><th>Customer</th><th>Location</th><th>Waiting</th><th>Still to deliver</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>
 ${rows.slice(0,300).map(({d,di})=>{
  const days=Math.floor((Date.now()-new Date(d.doc_date))/864e5),
   pend=di.items.filter(x=>x.pend>0.0001),ready=pend.every(x=>((s[x.code]||{})[d.location_id]||0)>=x.pend-0.0001);
  return`<tr><td><b>${esc(d.doc_no)}</b></td><td>${d.doc_date}</td><td>${esc(d.partner||'')}</td><td>${esc(ln(d.location_id))}</td><td><span class="badge ${days>7?'bad':'ok'}">${days}d</span></td><td style="white-space:normal;min-width:180px">${esc(pend.map(x=>x.code+' × '+fmt(x.pend)).join(', '))}</td><td>${ready?'<span class="badge ok">Ready</span>':'<span class="badge warn">Short</span>'}</td><td>${dlBadge(di.st)}</td><td class="act"><button class="btn sm ${W?'ok':''}" onclick="dlOpen('${d.id}')">${W?'Deliver':'View'}</button></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">Nothing is waiting for delivery.</td></tr>'}</tbody></table>`}
V.sdel=()=>{
 if(S.dlOff)return['Pending Deliveries','<div class="empty">Sale deliveries are not set up yet. Run the SQL for it first.</div>'];
 return['Pending Deliveries',`<div class="page-head"><b id="dp_n"></b><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">${locSelHtml()}<input class="input" style="width:220px" id="dp_q" placeholder="Search customer, product..." oninput="dlPendDraw()"></div></div><div class="card"><div class="tw" id="dp_t"></div></div>`,()=>{RDRAW=dlPendDraw;dlPendDraw()}]};
addNav('Sales','sdel','Pending Deliveries','sale');
NAVORD.splice(NAVORD.indexOf('sale-r')+1,0,'sdel');sortNav();

/* ---------- Excel sheets ---------- */
SH['Deliveries']=()=>S.dlOff?[['Sale deliveries are not set up yet']]:[['Sale no','Customer','Location','Delivered on','Code','Description','Qty delivered','Note'],
 ...xD('sale',false).flatMap(d=>(d.deliveries||[]).filter(r=>xIn({doc_date:r.deliver_date})).flatMap(r=>r.lines.map(l=>[d.doc_no,d.partner,ln(d.location_id),r.deliver_date,l.code,(d.lines.find(x=>x.code===l.code)||{}).desc||'',l.qty,r.note||''])))];
SH['Pending Deliveries']=()=>S.dlOff?[['Sale deliveries are not set up yet']]:[['Sale no','Date','Customer','Location','Code','Description','Sold','Delivered','Pending','Days waiting'],
 ...xD('sale',false).flatMap(d=>dlInfo(d).items.filter(x=>x.pend>0.0001).map(x=>[d.doc_no,d.doc_date,d.partner,ln(d.location_id),x.code,x.desc,x.ord,x.got,x.pend,xAge(d)]))];
REP.push(['Deliveries','Goods delivered to customers, delivery by delivery'],['Pending Deliveries','Sold goods that have not been delivered yet']);

/* ---------- backup and restore carry the deliveries ---------- */
xBackup=function(){
 const o={app:'retailpro',version:4,shop:me().name||'',exported_at:new Date().toISOString(),
  locations:S.locations,products:S.products,customers:S.customers,suppliers:S.suppliers,expenses:S.expenses,expense_categories:S.xcats||[],
  documents:S.docs.map(d=>({id:d.id,doc_type:d.doc_type,doc_no:d.doc_no,doc_date:d.doc_date,partner:d.partner,location_id:d.location_id,to_location_id:d.to_location_id,note:d.note,reason:d.reason,
   lines:d.lines.map(l=>({code:l.code,desc:l.desc,qty:l.qty,price:l.price,cost:l.cost})),
   payments:(d.payments||[]).map(p=>({pay_date:p.pay_date,amount:p.amount,method:p.method,note:p.note,receipt_id:p.receipt_id})),
   ...(d.doc_type==='purchase'&&!S.grOff?{receipts:(d.receipts||[]).map(r=>({recv_date:r.recv_date,note:r.note,lines:r.lines}))}:{}),
   ...(d.doc_type==='sale'&&!S.dlOff?{deliveries:(d.deliveries||[]).map(r=>({deliver_date:r.deliver_date,note:r.note,lines:r.lines}))}:{})}))};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));
 a.download='retailpro_backup_'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
 try{localStorage.setItem('lastExport',new Date().toLocaleString())}catch(e){}toast('Backup downloaded')};
const _rs9=rsRun;
rsRun=async function(){
 const snap=RB;await _rs9();
 if(!snap||S.dlOff)return;
 const sa=snap.docs.filter(d=>d.doc_type==='sale');if(!sa.length)return;
 try{
  let n=0;
  for(const bd of sa){
   const d=S.docs.find(x=>x.doc_type==='sale'&&x.doc_no===bd.doc_no);
   if(!d||(d.deliveries||[]).length)continue;
   const rs=Array.isArray(bd.deliveries)?bd.deliveries:[{deliver_date:bd.doc_date,note:'Restored',lines:(bd.lines||[]).map(l=>({code:l.code,qty:l.qty}))}];
   for(const r of rs)if(r.lines&&r.lines.length){await dlInsert(d.id,r.deliver_date||bd.doc_date,r.note,r.lines);n++}}
  if(n){await load();toast(n+' delivery record(s) restored')}
 }catch(e){toast('Documents restored, but deliveries could not be restored: '+dErr(e))}};
