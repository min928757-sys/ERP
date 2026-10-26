'use strict';
/* Stage 4a: credit payments (oldest invoice first), unpaid lists, statements */
const isRet=p=>p.method==='Return credit';
const sd=(a,b)=>a.doc_date.localeCompare(b.doc_date)||(a.created_at||'').localeCompare(b.created_at||'')||String(a.doc_no).localeCompare(String(b.doc_no),undefined,{numeric:true});
const vdocs=()=>LF?S.docs.filter(d=>d.location_id===LF||d.to_location_id===LF):S.docs;
const canPay=t=>!readOnly()&&can(t);
let OWN=[],OWALL=false,RC=null,CURP=null,PGR=[],PBUSY=false;

/* one customer / supplier: invoices, balance, return credit */
function ptnr(type,name,docs){
 docs=docs||S.docs;const ret=type==='sale'?'sret':'pret';
 const inv=docs.filter(d=>d.doc_type===type&&(d.partner||'')===name).sort(sd).map(d=>({d,bal:R2(dt(d)-(d.paid||0))}));
 const returns=docs.filter(d=>d.doc_type===ret&&(d.partner||'')===name).reduce((a,d)=>a+dt(d),0);
 const used=inv.reduce((a,x)=>a+(x.d.payments||[]).filter(isRet).reduce((b,p)=>b+ +p.amount,0),0);
 const open=inv.filter(x=>x.bal>0.005),tot=R2(open.reduce((a,x)=>a+x.bal,0)),credit=Math.max(0,R2(returns-used));
 return{inv,open,tot,credit,net:R2(tot-credit)}}

/* ---------- unpaid list: one row per customer / supplier ---------- */
function owDraw(type){
 const el=$('#owb');if(!el)return;
 const docs=vdocs(),q=($('#ow_q')?$('#ow_q').value:'').trim().toLowerCase(),isS=type==='sale',ret=isS?'sret':'pret',W=canPay(type);
 const names=[...new Set(docs.filter(d=>d.doc_type===type||d.doc_type===ret).map(d=>d.partner||''))];
 const rows=names.filter(n=>n.toLowerCase().includes(q)).map(n=>{
   const x=ptnr(type,n,docs);let last='';
   x.inv.forEach(o=>(o.d.payments||[]).forEach(p=>{if(!isRet(p)&&(p.pay_date||'')>last)last=p.pay_date||''}));
   return{n,...x,last}})
  .filter(x=>OWALL||x.tot>0.005||x.credit>0.005)
  .sort((a,b)=>b.net-a.net||a.n.localeCompare(b.n));
 OWN=rows.map(x=>x.n);
 $('#ow_sum').textContent=rows.length+(isS?' customers':' suppliers')+' · '+(isS?'they owe ':'you owe ')+fmt(rows.reduce((a,x)=>a+x.net,0))+' Ks';
 el.innerHTML=`<table><thead><tr><th>${isS?'Customer':'Supplier'}</th><th class="num">Unpaid invoices</th><th class="num">Invoice balance</th><th class="num">Return credit</th><th class="num">Net due</th><th>Oldest unpaid</th><th>Last payment</th><th></th></tr></thead><tbody>
 ${rows.slice(0,300).map((x,i)=>{
  const o=x.open[0],days=o?Math.floor((Date.now()-new Date(o.d.doc_date))/864e5):0,settled=x.tot<=0.005&&x.credit<=0.005;
  return`<tr><td><b>${esc(x.n||'-')}</b></td><td class="num">${x.open.length}</td><td class="num">${fmt(x.tot)}</td><td class="num">${x.credit?'-'+fmt(x.credit):''}</td><td class="num"><b>${fmt(x.net)}</b>${settled?' <span class="badge ok">Settled</span>':''}</td><td>${o?o.d.doc_date+' <span class="badge '+(days>30?'bad':'ok')+'">'+days+'d</span>':'-'}</td><td>${x.last||'-'}</td><td class="act"><button class="btn sm" onclick="stmtShow('${type}',OWN[${i}])">Statement</button>${W&&x.tot>0.005?`<button class="btn sm ok" onclick="rcvOpen('${type}',OWN[${i}])">${isS?'Receive':'Pay'}</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Nothing found.</td></tr>'}</tbody></table>`}
function owPage(type){
 OWALL=false;const isS=type==='sale';
 return[isS?'Unpaid Sales (Receivables)':'Unpaid Purchases (Payables)',`<div class="page-head"><b id="ow_sum"></b><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">${locSelHtml()}<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" onchange="OWALL=this.checked;owDraw('${type}')"> Include fully paid</label><input class="input" style="width:220px" id="ow_q" placeholder="Search ${isS?'customer':'supplier'}..." oninput="owDraw('${type}')"></div></div>
 <div class="card"><div class="tw" id="owb"></div></div>`,()=>{RDRAW=()=>owDraw(type);owDraw(type)}]}
V.recv=()=>owPage('sale');V.pay=()=>owPage('purchase');
addNav('Sales','recv','Unpaid / Receivables','sale');
addNav('Purchase','pay','Unpaid / Payables','purchase');

/* ---------- statement ---------- */
function stmtLines(type,name){
 const ret=type==='sale'?'sret':'pret',L=[],G={};PGR=[];
 S.docs.filter(d=>(d.partner||'')===name).forEach(d=>{
  if(d.doc_type===type){
   L.push({date:d.doc_date,o:1,txt:d.doc_no,dr:dt(d),cr:0});
   (d.payments||[]).forEach(p=>{
    const k=p.receipt_id||p.id,g=G[k]=G[k]||{cashIds:[],credIds:[],date:p.pay_date,method:'',note:'',cash:0,cred:0};
    if(isRet(p)){g.credIds.push(p.id);g.cred+=+p.amount}
    else{g.cashIds.push(p.id);g.cash+=+p.amount;g.method=g.method||p.method||'';g.note=g.note||p.note||''}})}
  else if(d.doc_type===ret)L.push({date:d.doc_date,o:2,txt:d.doc_no+' (return)',dr:0,cr:dt(d)})});
 Object.values(G).forEach(g=>{PGR.push(g);
  L.push({date:g.date,o:3,txt:'Payment'+(g.method?' ('+g.method+')':'')+(g.note?' - '+g.note:'')+(g.cred?' [return credit applied: '+fmt(g.cred)+']':''),dr:0,cr:g.cash,gi:PGR.length-1})});
 L.sort((a,b)=>a.date.localeCompare(b.date)||a.o-b.o||a.txt.localeCompare(b.txt));
 let bal=0;L.forEach(r=>{bal=R2(bal+r.dr-r.cr);r.bal=bal});return L}
function stmtView(){
 const {type,name,f,t}=CURP,L=stmtLines(type,name),before=f?L.filter(r=>r.date<f):[],open=before.length?before[before.length-1].bal:0,
  rows=L.filter(r=>(!f||r.date>=f)&&(!t||r.date<=t));
 return{rows,open,close:rows.length?rows[rows.length-1].bal:open,cur:L.length?L[L.length-1].bal:0}}
function stmtShow(type,name,keep){CURP={type,name,f:keep&&CURP?CURP.f:'',t:keep&&CURP?CURP.t:''};stmtDraw()}
function stmtById(tbl,id){const r=S[tbl].find(x=>x.id===id);if(r)stmtShow(tbl==='customers'?'sale':'purchase',r.name)}
function stmtPre(k){
 const d=new Date(),x=new Date(d.getFullYear(),d.getMonth()-(k==='3'?2:0),1),p=n=>String(n).padStart(2,'0');
 CURP.f=k==='all'?'':x.getFullYear()+'-'+p(x.getMonth()+1)+'-01';CURP.t='';stmtDraw()}
function stmtDraw(){
 const {type,name,f,t}=CURP,v=stmtView(),isS=type==='sale',ce=canEd(),filt=!!(f||t),
  dr=v.rows.reduce((a,r)=>a+r.dr,0),cr=v.rows.reduce((a,r)=>a+r.cr,0);
 openModal(`<div class="mbox" style="max-width:760px"><h3>Statement: ${esc(name||'-')}</h3>
 <div class="hg" style="margin-bottom:8px"><div class="field"><label>From</label><input class="input" type="date" value="${f}" onchange="CURP.f=this.value;stmtDraw()"></div><div class="field"><label>To</label><input class="input" type="date" value="${t}" onchange="CURP.t=this.value;stmtDraw()"></div></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><button class="btn sm" onclick="stmtPre('m')">This month</button><button class="btn sm" onclick="stmtPre('3')">Last 3 months</button><button class="btn sm" onclick="stmtPre('all')">All dates</button></div>
 <div class="tw"><table><thead><tr><th>Date</th><th>Details</th><th class="num">${isS?'Sold':'Bought'}</th><th class="num">Paid / returned</th><th class="num">Balance</th><th></th></tr></thead><tbody>
 ${filt?`<tr style="background:#f8fafc"><td>${f||''}</td><td><b>Opening balance</b></td><td></td><td></td><td class="num"><b>${fmt(v.open)}</b></td><td></td></tr>`:''}
 ${v.rows.map(r=>`<tr><td>${r.date}</td><td style="white-space:normal">${esc(r.txt)}</td><td class="num">${r.dr?fmt(r.dr):''}</td><td class="num">${r.cr?fmt(r.cr):''}</td><td class="num">${fmt(r.bal)}</td><td class="act">${ce&&r.gi!==undefined?`<button class="btn sm" onclick="payEdit(${r.gi})">Edit</button><button class="btn sm d" onclick="payDel(${r.gi})">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No records in this period.</td></tr>'}</tbody></table></div>
 <div class="row"><span>${isS?'Sold':'Bought'} in this period</span><b>${fmt(dr)}</b></div>
 <div class="row"><span>Paid / returned in this period</span><b>${fmt(cr)}</b></div>
 <div class="tot"><span>${isS?'Customer owes':'You owe'}${filt?' at end of period':''}</span><span>${fmt(v.close)}</span> Ks</div>
 ${filt&&Math.abs(v.cur-v.close)>0.005?`<p class="mu" style="margin-bottom:8px">Balance today (all dates): <b>${fmt(v.cur)} Ks</b></p>`:''}
 <div class="mact"><button class="btn" onclick="prtStmt()">Print</button>${v.cur>0.005&&canPay(type)?`<button class="btn ok" onclick="rcvOpen('${type}',CURP.name)">${isS?'Receive payment':'Make payment'}</button>`:''}<button class="btn" onclick="stClose()">Close</button></div></div>`)}
function stClose(){
 mclose();const b=document.querySelector('.si.on'),id=b&&b.dataset.id;
 if(id==='recv')owDraw('sale');else if(id==='pay')owDraw('purchase');else if(id&&V[id])go(id)}
function prtStmt(){
 const {type,name,f,t}=CURP,v=stmtView(),filt=!!(f||t);
 $('#print').innerHTML=`<h2>${esc(me().name||'')}</h2><h3>Statement of account</h3><p>${type==='sale'?'Customer':'Supplier'}: <b>${esc(name||'-')}</b> &nbsp; Printed: ${today()}</p><p>Period: ${filt?(f||'start')+' to '+(t||'today'):'All dates'}</p>
 <table><thead><tr><th>Date</th><th>Details</th><th>${type==='sale'?'Sold':'Bought'}</th><th>Paid / returned</th><th>Balance</th></tr></thead><tbody>
 ${filt?`<tr><td>${f||''}</td><td><b>Opening balance</b></td><td></td><td></td><td>${fmt(v.open)}</td></tr>`:''}
 ${v.rows.map(r=>`<tr><td>${r.date}</td><td>${esc(r.txt)}</td><td>${r.dr?fmt(r.dr):''}</td><td>${r.cr?fmt(r.cr):''}</td><td>${fmt(r.bal)}</td></tr>`).join('')}</tbody></table>
 <h3 style="text-align:right">Balance${filt?' at end of period':''}: ${fmt(v.close)} Ks</h3>`;
 window.print()}

/* ---------- edit / delete a payment (owner or Edit permission) ---------- */
function payEdit(i){
 const g=PGR[i];if(!g)return;const ms=['',...new Set([g.method,...PM].filter(Boolean))];
 openModal(`<div class="mbox"><h3>Edit payment</h3><p class="mu" style="margin-bottom:12px">Amount ${fmt(g.cash)} Ks. To change the amount, delete this payment and enter it again.</p>
 <div class="field"><label>Date</label><input class="input" id="pe_d" type="date" value="${g.date||''}"></div>
 <div class="field"><label>Method</label><select class="input" id="pe_m">${ms.map(m=>`<option value="${esc(m)}" ${m===g.method?'selected':''}>${m||'-'}</option>`).join('')}</select></div>
 <div class="field"><label>Note</label><input class="input" id="pe_n" value="${esc(g.note)}"></div>
 <div class="mact"><button class="btn" onclick="stmtShow(CURP.type,CURP.name,true)">Back</button><button class="btn primary" onclick="payUpd(${i})">Save</button></div></div>`)}
async function payUpd(i){
 const g=PGR[i],d=$('#pe_d').value;if(!g||!d)return toast('Choose a date');
 let n=0;
 if(g.cashIds.length){const r=await sb.from('payments').update({pay_date:d,method:$('#pe_m').value||null,note:$('#pe_n').value.trim()||null}).in('id',g.cashIds).select('id');if(r.error)return toast(dErr(r.error));n+=r.data.length}
 if(g.credIds.length){const r=await sb.from('payments').update({pay_date:d}).in('id',g.credIds).select('id');if(r.error)return toast(dErr(r.error));n+=r.data.length}
 if(n<g.cashIds.length+g.credIds.length)return toast('Not allowed: only the owner or someone with Edit permission can change payments.');
 await load();toast('Saved');stmtShow(CURP.type,CURP.name,true)}
async function payDel(i){
 const g=PGR[i];if(!g||!confirm('Delete this payment ('+fmt(g.cash)+' Ks)? The invoices will show as unpaid again.'))return;
 const ids=g.cashIds.concat(g.credIds),r=await sb.from('payments').delete().in('id',ids).select('id');
 if(r.error)return toast(dErr(r.error));
 if(r.data.length<ids.length)return toast('Not allowed: only the owner or someone with Edit permission can delete payments.');
 await load();toast('Deleted');stmtShow(CURP.type,CURP.name,true)}

/* ---------- receive / make a payment: one amount, split over the oldest invoices ---------- */
function rcvOpen(type,name){
 if(!canPay(type))return toast('You do not have permission to take payments.');
 const x=ptnr(type,name);if(x.tot<=0.005)return toast('Nothing outstanding');
 RC={type,name};const isS=type==='sale';
 openModal(`<div class="mbox"><h3>${isS?'Receive payment':'Make payment'}: ${esc(name||'-')}</h3>
 <div class="row"><span>Unpaid invoices</span><b>${fmt(x.tot)} Ks</b></div>
 ${x.credit?`<div class="row"><span>Return credit available</span><b>${fmt(x.credit)} Ks</b></div>`:''}
 <div class="field" style="margin-top:12px"><label>Date</label><input class="input" id="rc_d" type="date" value="${today()}"></div>
 <div class="field"><label>Amount ${isS?'received':'paid'}</label><input class="input" id="rc_a" type="number" min="0" step="any" inputmode="decimal" value="${Math.max(0,R2(x.tot-x.credit))}" oninput="rcvPrev()"></div>
 <div class="field"><label>Method</label><select class="input" id="rc_m">${PM.map(m=>`<option>${m}</option>`).join('')}</select></div>
 <div class="field"><label>Note</label><input class="input" id="rc_n"></div>
 ${x.credit?'<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="rc_c" checked onchange="rcvPrev()"> Use return credit first</label>':''}
 <div id="rc_p" class="mu" style="margin:10px 0"></div>
 <div class="mact"><button class="btn" onclick="mclose()">Cancel</button><button class="btn ok" id="rc_s" onclick="rcvSave()">Save</button></div></div>`);
 rcvPrev()}
function rcvPlan(){
 const x=ptnr(RC.type,RC.name),cash=R2($('#rc_a').value),useC=!!($('#rc_c')&&$('#rc_c').checked);
 if(cash<0)return{error:'Enter an amount'};
 if(cash>x.tot+0.005)return{error:'More than the unpaid amount ('+fmt(x.tot)+' Ks)'};
 const credit=useC?Math.min(x.credit,R2(x.tot-cash)):0;
 if(cash+credit<=0)return{error:'Enter an amount'};
 let m=cash,c=credit;const rows=[];
 for(const o of x.open){let need=o.bal;
  const fc=Math.min(c,need);if(fc>0.004){rows.push({d:o.d,amount:R2(fc),credit:true});c=R2(c-fc);need=R2(need-fc)}
  const fm=Math.min(m,need);if(fm>0.004){rows.push({d:o.d,amount:R2(fm),credit:false});m=R2(m-fm)}
  if(c<=0.004&&m<=0.004)break}
 return{rows,cash,credit,x}}
function rcvPrev(){
 const el=$('#rc_p');if(!el)return;const p=rcvPlan();
 if(p.error){el.textContent=p.error;return}
 const left=R2(p.x.tot-p.cash-p.credit);
 el.innerHTML='Applied to the oldest invoices first:<br>'+p.rows.map(r=>esc(r.d.doc_no)+': '+fmt(r.amount)+(r.credit?' (return credit)':'')).join('<br>')+(left>0.005?'<br><b>Still unpaid after this: '+fmt(left)+' Ks</b>':'<br><b>Fully settled</b>')}
async function rcvSave(){
 if(PBUSY)return;const p=rcvPlan();if(p.error)return toast(p.error);
 const date=$('#rc_d').value||today();
 const rid=crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
 const method=$('#rc_m').value,note=$('#rc_n').value.trim()||null,
  rows=p.rows.map(r=>({tenant_id:T,document_id:r.d.id,pay_date:date,amount:r.amount,method:r.credit?'Return credit':method,note:r.credit?'Applied from return credit':note,receipt_id:rid}));
 PBUSY=true;const b=$('#rc_s');if(b)b.disabled=true;
 try{
  const {error}=await sb.from('payments').insert(rows);if(error)throw error;
  const nm=RC.name,tp=RC.type;await load();toast('Saved');stmtShow(tp,nm,false)
 }catch(e){toast(dErr(e))}
 finally{PBUSY=false;const b2=$('#rc_s');if(b2)b2.disabled=false}}
