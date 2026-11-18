'use strict';
/* Stage 10: payment method filter on Records, and Daily Collection (money in and money out) */
const NR='Not recorded';
const dcMeth=p=>p.method||NR;
const pmOrder=m=>{const i=PM.indexOf(m);return i>=0?i:(m===NR?90:50)};
const payList=d=>(d.payments||[]).filter(p=>!isRet(p));

/* ---------- Sale / Purchase Records: payment method filter, "Paid by" column ---------- */
let RMF='';
const _rr11=recRows;
recRows=function(){
 const rows=_rr11();
 if((RT!=='sale'&&RT!=='purchase')||!RMF)return rows;
 return rows.filter(x=>{const ps=payList(x.d);
  if(RMF==='_none')return ps.length===0;
  return ps.some(p=>dcMeth(p)===RMF)})};
const _rp11=recPage;
recPage=function(type){
 RMF='';const r=_rp11(type);
 if(type==='sale'||type==='purchase'){
  const opts=[...PM,NR].map(m=>`<option>${esc(m)}</option>`).join('');
  r[1]=r[1].replace('<div class="field"><label>&nbsp;</label><button class="btn" onclick="go(','<div class="field"><label>Payment method</label><select class="input" onchange="RMF=this.value;recDraw()"><option value="">All</option><option value="_none">No payment yet (credit)</option>'+opts+'</select></div><div class="field"><label>&nbsp;</label><button class="btn" onclick="go(')}
 return r};
function payDecorate(){
 const tb=document.querySelector('#r_tbl table');if(!tb)return;
 const hr=tb.querySelector('thead tr');if(!hr)return;
 const th=document.createElement('th');th.textContent='Paid by';hr.insertBefore(th,hr.lastElementChild);
 tb.querySelectorAll('tbody tr').forEach(tr=>{
  const tds=tr.children;if(tds.length<5)return;
  const no=tds[0].textContent.trim(),d=S.docs.find(x=>x.doc_type===RT&&x.doc_no===no);if(!d)return;
  const ms=[...new Set(payList(d).map(dcMeth))],td=document.createElement('td');
  td.style.whiteSpace='normal';td.textContent=ms.length?ms.join(', '):'-';
  tr.insertBefore(td,tds[tds.length-1])});
 if(RMF&&RMF!=='_none'){
  const got=recRows().reduce((a,x)=>a+payList(x.d).filter(p=>dcMeth(p)===RMF).reduce((b,p)=>b+ +p.amount,0),0);
  $('#r_tiles').insertAdjacentHTML('beforeend','<div class="card kpi"><div class="mu">'+(RT==='sale'?'Received':'Paid')+' by '+esc(RMF)+'</div><div class="val" style="font-size:19px">'+fmt(got)+' Ks</div></div>')}}
const _rd11=recDraw;
recDraw=function(){_rd11();if(RT==='sale'||RT==='purchase')payDecorate()};

/* ---------- Daily Collection ---------- */
const DC={f:'',t:'',v:'all',m:'',cnt:{}};
let DCM=[],DCNET={};
const dcAllowed=()=>({sale:can('sale'),purchase:can('purchase'),expense:can('expenses')});
const dcVName={all:'All',sale:'Sales',purchase:'Purchases',expense:'Expenses'};

/* every payment received, payment made and expense in a period */
function dcMoves(f,t){
 const A=ALW(),al=dcAllowed(),out=[],inR=x=>x>=f&&x<=t;
 S.docs.forEach(d=>{
  if((d.doc_type!=='sale'&&d.doc_type!=='purchase')||!al[d.doc_type])return;
  if(LF&&d.location_id!==LF)return;
  const isS=d.doc_type==='sale';
  payList(d).forEach(p=>{const dd=p.pay_date||'';if(!inR(dd))return;
   out.push({date:dd,kind:d.doc_type,ref:d.doc_no,party:d.partner||'',loc:d.location_id,m:dcMeth(p),inn:isS?+p.amount:0,out:isS?0:+p.amount})})});
 if(al.expense)S.expenses.forEach(e=>{
  const dd=e.expense_date||'';if(!inR(dd))return;
  if(LF&&e.location_id!==LF)return;
  if(!LF&&A&&!(e.location_id&&A.has(e.location_id)))return;
  out.push({date:dd,kind:'expense',ref:e.category||'Other',party:e.description||'',loc:e.location_id||'',m:e.method||NR,inn:0,out:+e.amount})});
 return out.sort((a,b)=>a.date.localeCompare(b.date)||a.kind.localeCompare(b.kind)||String(a.ref).localeCompare(String(b.ref),undefined,{numeric:true}))}
function dcByMethod(rows){
 const m={};
 rows.forEach(r=>{const o=m[r.m]=m[r.m]||{m:r.m,inn:0,out:0,n:0};o.inn+=r.inn;o.out+=r.out;o.n++});
 return Object.values(m).sort((a,b)=>pmOrder(a.m)-pmOrder(b.m)||a.m.localeCompare(b.m))}
function dcByLoc(rows){
 const m={};
 rows.forEach(r=>{const k=r.loc||'_gen',o=m[k]=m[k]||{id:r.loc||'',name:r.loc?ln(r.loc):'General (no location)',inn:0,out:0};o.inn+=r.inn;o.out+=r.out});
 return Object.values(m).sort((a,b)=>a.name.localeCompare(b.name))}
function dcInv(type){
 const docs=S.docs.filter(d=>d.doc_type===type&&d.doc_date>=DC.f&&d.doc_date<=DC.t&&(!LF||d.location_id===LF)),
  tot=sum(docs),paid=docs.reduce((a,d)=>a+(d.paid||0),0);
 return{n:docs.length,tot,paid,left:R2(tot-paid)}}
const dcRowsNow=()=>{const all=dcMoves(DC.f,DC.t);return DC.v==='all'?all:all.filter(r=>r.kind===DC.v)};
const dcPer=()=>DC.f===DC.t?DC.f:DC.f+' to '+DC.t;
function dcDiff(m){
 const v=DC.cnt[m];if(v===undefined||v==='')return'';
 const d=R2(+v-(DCNET[m]||0));
 return d===0?'<span class="badge ok">Matches</span>':'<span class="badge bad">'+(d>0?'+':'')+fmt(d)+'</span>'}
function dcCnt(i,v){DC.cnt[DCM[i]]=v;const el=$('#dc_d'+i);if(el)el.innerHTML=dcDiff(DCM[i])}
function dcPick(i){DC.m=DC.m===DCM[i]?'':DCM[i];dcDraw()}
function dcDay(n){DC.f=DC.t=dAdd(today(),n);DC.cnt={};DC.m='';dcFull()}
function dcLoc(){DC.cnt={};DC.m='';dcFull()}
function dcGo(id){LF=id;DC.cnt={};DC.m='';dcFull()}

function dcHtml(){
 const al=dcAllowed(),
  segs=[['all','All'],...(al.sale?[['sale','Sales']]:[]),...(al.purchase?[['purchase','Purchases']]:[]),...(al.expense?[['expense','Expenses']]:[])];
 if(!segs.some(s=>s[0]===DC.v))DC.v='all';
 const seg=segs.map(([k,t])=>`<button class="btn sm ${DC.v===k?'primary':''}" onclick="DC.v='${k}';DC.m='';DC.cnt={};dcFull()">${t}</button>`).join('');
 return`<div class="page-head"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
  <button class="btn sm" onclick="dcDay(0)">Today</button><button class="btn sm" onclick="dcDay(-1)">Yesterday</button>
  <input class="input" style="width:auto" type="date" value="${DC.f}" onchange="DC.f=this.value||today();if(DC.t<DC.f)DC.t=DC.f;DC.cnt={};dcFull()">
  <input class="input" style="width:auto" type="date" value="${DC.t}" onchange="DC.t=this.value||today();if(DC.t<DC.f)DC.f=DC.t;DC.cnt={};dcFull()"></div>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${locSelHtml()}<button class="btn primary" onclick="dcPrint()">Print</button></div></div>
 <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${seg}</div><div id="dc_body"></div>`}
function dcFull(){const v=document.querySelector('#content .view');if(v){v.innerHTML=dcHtml();dcDraw()}}

function dcDraw(){
 const el=$('#dc_body');if(!el)return;
 const al=dcAllowed(),rows=dcRowsNow(),bm=dcByMethod(rows),
  TI=rows.reduce((a,r)=>a+r.inn,0),TO=rows.reduce((a,r)=>a+r.out,0),
  multi=!LF&&vLocs().length>1,bl=multi?dcByLoc(rows):[],detail=DC.m?rows.filter(r=>r.m===DC.m):rows;
 DCM=bm.map(x=>x.m);DCNET={};bm.forEach(x=>DCNET[x.m]=R2(x.inn-x.out));
 const kpi=(l,v,col)=>`<div class="card kpi"><div class="mu">${l}</div><div class="val" style="${col?'color:'+col:''}">${fmt(v)} Ks</div></div>`;
 let h=`<div class="grid">${kpi('Money in',TI,'#0f9d58')}${kpi('Money out',TO,'#d92d20')}${kpi('Net',R2(TI-TO))}<div class="card kpi"><div class="mu">Entries</div><div class="val">${fmt(rows.length)}</div></div></div>`;
 const iv=[];
 if(al.sale&&(DC.v==='all'||DC.v==='sale'))iv.push(['Sales',dcInv('sale')]);
 if(al.purchase&&(DC.v==='all'||DC.v==='purchase'))iv.push(['Purchases',dcInv('purchase')]);
 if(iv.length)h+=`<div class="card"><div class="card-h">Invoices written in this period <span class="mu">(${esc(dcPer())})</span></div><div class="tw"><table><thead><tr><th></th><th class="num">Invoices</th><th class="num">Total</th><th class="num">Paid so far</th><th class="num">Still unpaid</th></tr></thead><tbody>${iv.map(([n,i])=>`<tr><td><b>${n}</b></td><td class="num">${fmt(i.n)}</td><td class="num">${fmt(i.tot)}</td><td class="num">${fmt(i.paid)}</td><td class="num">${fmt(i.left)}</td></tr>`).join('')}</tbody></table></div></div>`;
 if(!bm.length)h+='<div class="card"><div class="empty">No payments or expenses were recorded in this period.</div></div>';
 else{
  h+=`<div class="grid">${bm.map((x,i)=>`<div class="card kpi" style="cursor:pointer;${DC.m===x.m?'outline:2px solid var(--pr)':''}" onclick="dcPick(${i})"><div class="mu">${esc(x.m)} · ${x.n} entr${x.n===1?'y':'ies'}</div>${x.inn?`<div style="color:#0f9d58;font-weight:700">+ ${fmt(x.inn)}</div>`:''}${x.out?`<div style="color:#d92d20;font-weight:700">- ${fmt(x.out)}</div>`:''}<div class="mu">Net ${fmt(R2(x.inn-x.out))} Ks</div></div>`).join('')}</div>`;
  h+=`<div class="card"><div class="card-h">Check against what you hold</div><div class="tw"><table><thead><tr><th>Method</th><th class="num">In</th><th class="num">Out</th><th class="num">Should be</th><th class="num">Counted</th><th>Difference</th></tr></thead><tbody>${bm.map((x,i)=>`<tr><td><b>${esc(x.m)}</b></td><td class="num">${fmt(x.inn)}</td><td class="num">${fmt(x.out)}</td><td class="num"><b>${fmt(R2(x.inn-x.out))}</b></td><td class="num"><input class="input" style="width:112px;text-align:right" type="number" step="any" inputmode="decimal" value="${esc(DC.cnt[x.m]===undefined?'':DC.cnt[x.m])}" oninput="dcCnt(${i},this.value)"></td><td id="dc_d${i}">${dcDiff(x.m)}</td></tr>`).join('')}</tbody></table></div><div class="card-b mu">"Should be" is the money in minus the money out during this period (it does not include what you had before). Enter what you counted, or the amount shown in the bank / wallet app for the same period. Nothing here is saved.</div></div>`}
 if(bl.length)h+=`<div class="card"><div class="card-h">By location</div><div class="tw"><table><thead><tr><th>Location</th><th class="num">Money in</th><th class="num">Money out</th><th class="num">Net</th><th></th></tr></thead><tbody>${bl.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td class="num">${fmt(x.inn)}</td><td class="num">${fmt(x.out)}</td><td class="num">${fmt(R2(x.inn-x.out))}</td><td class="act">${x.id?`<button class="btn sm" onclick="dcGo('${x.id}')">Open</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`;
 const kb={sale:'<span class="badge ok">Sale</span>',purchase:'<span class="badge warn">Purchase</span>',expense:'<span class="badge bad">Expense</span>'};
 h+=`<div class="card"><div class="card-h" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>Details (${detail.length})</span>${DC.m?`<button class="btn sm" onclick="DC.m='';dcDraw()">${esc(DC.m)} ×</button>`:''}</div><div class="tw"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Party / description</th><th>Location</th><th>Method</th><th class="num">In</th><th class="num">Out</th></tr></thead><tbody>${detail.slice(0,300).map(r=>`<tr><td>${r.date}</td><td>${kb[r.kind]}</td><td>${esc(r.ref)}</td><td style="white-space:normal">${esc(r.party)}</td><td>${r.loc?esc(ln(r.loc)):'<span class="mu">General</span>'}</td><td>${esc(r.m)}</td><td class="num">${r.inn?fmt(r.inn):''}</td><td class="num">${r.out?fmt(r.out):''}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">Nothing recorded.</td></tr>'}${detail.length>300?`<tr><td colspan="8" class="empty">Showing the first 300 of ${detail.length}. Totals above include all of them.</td></tr>`:''}</tbody></table></div></div>
 <p class="mu">Payments are counted on the day the money was received or paid. Return credit is not counted (it is not money). Cash refunds to customers are not recorded by the system.</p>`;
 el.innerHTML=h}

function dcPrint(){
 const rows=dcRowsNow(),bm=dcByMethod(rows),TI=rows.reduce((a,r)=>a+r.inn,0),TO=rows.reduce((a,r)=>a+r.out,0),
  multi=!LF&&vLocs().length>1,bl=multi?dcByLoc(rows):[];
 DCNET={};bm.forEach(x=>DCNET[x.m]=R2(x.inn-x.out));
 const cn=m=>{const v=DC.cnt[m];return(v===undefined||v==='')?null:+v},
  t1=`<div class="v-sub">By payment method</div><table><thead><tr><th>Method</th><th>In</th><th>Out</th><th>Should be</th><th>Counted</th><th>Difference</th></tr></thead><tbody>${bm.map(x=>{const c=cn(x.m),net=R2(x.inn-x.out);return`<tr><td>${esc(x.m)}</td><td>${fmt(x.inn)}</td><td>${fmt(x.out)}</td><td>${fmt(net)}</td><td>${c===null?'':fmt(c)}</td><td>${c===null?'':fmt(R2(c-net))}</td></tr>`}).join('')}<tr style="font-weight:700"><td>Total</td><td>${fmt(TI)}</td><td>${fmt(TO)}</td><td>${fmt(R2(TI-TO))}</td><td></td><td></td></tr></tbody></table>`,
  t2=bl.length?`<div class="v-sub">By location</div><table><thead><tr><th>Location</th><th>In</th><th>Out</th><th>Net</th></tr></thead><tbody>${bl.map(x=>`<tr><td>${esc(x.name)}</td><td>${fmt(x.inn)}</td><td>${fmt(x.out)}</td><td>${fmt(R2(x.inn-x.out))}</td></tr>`).join('')}</tbody></table>`:'',
  nm={sale:'Sale',purchase:'Purchase',expense:'Expense'},
  t3=`<div class="v-sub">Details</div><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Party / description</th><th>Location</th><th>Method</th><th>In</th><th>Out</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${nm[r.kind]}</td><td>${esc(r.ref)}</td><td>${esc(r.party)}</td><td>${r.loc?esc(ln(r.loc)):'General'}</td><td>${esc(r.m)}</td><td>${r.inn?fmt(r.inn):''}</td><td>${r.out?fmt(r.out):''}</td></tr>`).join('')||'<tr><td colspan="8">Nothing recorded.</td></tr>'}</tbody></table>`;
 pvPrintModel({kind:'daily',title:'Daily Collection',
  meta:[['Period',dcPer()],['Location',LF?ln(LF):(ALW()?'All my locations':'All locations')],['View',dcVName[DC.v]],['Printed',today()]],more:[],
  raw:t1+t2+t3,totals:[],pays:[],note:'',bank:false,sig:['Prepared by','Checked by']},pvNoThermal(pvS().paper))}

V.daily=()=>{
 const al=dcAllowed();
 if(!al.sale&&!al.purchase&&!al.expense)return['Daily Collection','<div class="empty">You do not have access to payment records.</div>'];
 DC.f=DC.t=today();DC.v='all';DC.m='';DC.cnt={};
 return['Daily Collection',dcHtml(),()=>{RDRAW=dcLoc;dcDraw()}]};
NAV.find(g=>g.g==='Accounts').items.unshift(['daily','Daily Collection']);

/* ---------- Excel sheets ---------- */
const dcX=()=>dcMoves(X.f||'0000-01-01',X.t||'9999-12-31');
SH['Money In and Out']=()=>[['Date','Type','Reference','Party / description','Location','Method','Money in','Money out'],
 ...dcX().map(r=>[r.date,{sale:'Sale',purchase:'Purchase',expense:'Expense'}[r.kind],r.ref,r.party,r.loc?ln(r.loc):'General',r.m,r.inn,r.out])];
SH['Collection by Method']=()=>[['Method','Money in','Money out','Net'],...dcByMethod(dcX()).map(x=>[x.m,x.inn,x.out,R2(x.inn-x.out)])];
REP.push(['Money In and Out','Every payment received, payment made and expense, by method'],['Collection by Method','Totals by payment method']);
