'use strict';
/* Stage 3b: records lists with filters and totals, view, delete */
let RF={q:'',p:'',f:'',t:'',st:''},RT='sale',RDRAW=null;

const locSelHtml=()=>{const A=ALW();
 return`<label style="display:flex;gap:6px;align-items:center;font-size:13px;font-weight:600">Location <select class="input" style="width:auto;padding:5px 8px" onchange="setLF(this.value)"><option value="">${A?'All my locations':'All locations'}</option>${vLocs().map(l=>`<option value="${l.id}" ${l.id===LF?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>`};
function setLF(v){LF=v;if(RDRAW)RDRAW()}

function recRows(){
 const q=RF.q.trim().toLowerCase(),p=RF.p.trim().toLowerCase();
 return S.docs.filter(d=>d.doc_type===RT&&(!LF||d.location_id===LF||d.to_location_id===LF))
  .filter(d=>!q||((d.doc_no||'')+' '+(d.partner||'')+' '+d.doc_date+' '+(d.note||'')).toLowerCase().includes(q))
  .filter(d=>(!RF.f||d.doc_date>=RF.f)&&(!RF.t||d.doc_date<=RF.t)&&(!RF.st||pst(d)===RF.st))
  .map(d=>({d,hit:p?d.lines.filter(l=>((l.code||'')+' '+(l.desc||'')).toLowerCase().includes(p)):[]}))
  .filter(x=>!p||x.hit.length)
  .sort((a,b)=>b.d.doc_date.localeCompare(a.d.doc_date)||String(b.d.doc_no).localeCompare(String(a.d.doc_no),undefined,{numeric:true}))}

function recDraw(){
 const c=DT[RT],isT=RT==='transfer',isP=!!c.pay,rows=recRows(),hasP=!!RF.p.trim(),W=canEd(),
  tot=rows.reduce((a,x)=>a+dt(x.d),0),paid=rows.reduce((a,x)=>a+(x.d.paid||0),0),
  per=(RF.f||RF.t)?(RF.f||'start')+' to '+(RF.t||'today'):'All dates',
  T1=[['Records',fmt(rows.length)+'<div class="mu" style="font-weight:400">'+esc(per)+'</div>']];
 if(!isT)T1.push(['Total amount',fmt(tot)+' Ks']);
 if(isP)T1.push(['Paid',fmt(paid)+' Ks'],['Unpaid',fmt(tot-paid)+' Ks']);
 if(hasP){const mq=rows.reduce((a,x)=>a+x.hit.reduce((b,l)=>b+l.qty,0),0),ma=rows.reduce((a,x)=>a+x.hit.reduce((b,l)=>b+l.qty*l.price,0),0);
  T1.push(['Matching items',fmt(mq)+' qty'+(isT?'':' · '+fmt(ma)+' Ks')])}
 $('#r_tiles').innerHTML=T1.map(([l,v])=>`<div class="card kpi"><div class="mu">${l}</div><div class="val" style="font-size:19px">${v}</div></div>`).join('');
 const eye=id=>`<button class="btn sm" title="View" aria-label="View" onclick="viewDoc('${id}')">${svg('eye')}</button>`,
  cols=isT?6:isP?8:7;
 $('#r_tbl').innerHTML=`<table><thead><tr><th>No.</th><th>Date</th><th>${isT?'From → To':c.pl}</th>${isT?'':'<th>Location</th>'}<th class="${hasP?'':'num'}">${hasP?'Matching items':'Items'}</th>${isT?'':'<th class="num">Total</th>'}${isP?'<th>Status</th>':''}<th></th></tr></thead><tbody>
 ${rows.slice(0,300).map(({d,hit})=>`<tr><td><b>${esc(d.doc_no)}</b></td><td>${d.doc_date}</td><td>${isT?esc(ln(d.location_id))+' → '+esc(ln(d.to_location_id)):esc(d.partner)}</td>${isT?'':`<td>${esc(ln(d.location_id))}</td>`}<td class="${hasP?'':'num'}" style="${hasP?'white-space:normal;min-width:150px':''}">${hasP?hit.map(l=>esc(l.code)+' × '+fmt(l.qty)).join(', '):d.lines.length}</td>${isT?'':`<td class="num">${fmt(dt(d))}</td>`}${isP?`<td>${pBadge(pst(d))}</td>`:''}<td class="act">${eye(d.id)}${W?`<button class="btn sm" onclick="go('${d.doc_type}','${d.id}')">Edit</button><button class="btn sm d" onclick="docDel('${d.id}')">Delete</button>`:''}</td></tr>`).join('')||`<tr><td colspan="${cols}" class="empty">No records found.</td></tr>`}
 ${rows.length>300?`<tr><td colspan="${cols}" class="empty">Showing the first 300 of ${rows.length}. Use the filters to narrow down. Totals above include all ${rows.length}.</td></tr>`:''}</tbody></table>`}

function recPage(type){
 RT=type;RF={q:'',p:'',f:'',t:'',st:''};const c=DT[type],isP=!!c.pay;
 const fld=(l,k,ty,ph)=>`<div class="field"><label>${l}</label><input class="input" type="${ty}" placeholder="${ph}" oninput="RF.${k}=this.value;recDraw()" onchange="RF.${k}=this.value;recDraw()"></div>`;
 return[c.t+' Records',`<div class="page-head">${locSelHtml()}${readOnly()?'':`<button class="btn primary" onclick="go('${type}')">+ New</button>`}</div>
 <div class="grid" id="r_tiles"></div>
 <details class="card"><summary style="padding:13px 18px;cursor:pointer;font-weight:600">Filter</summary><div class="card-b hg">${fld('Search','q','text','No, name, date, note...')}${fld('Product code or description','p','text','e.g. P-001')}${fld('From','f','date','')}${fld('To','t','date','')}${isP?'<div class="field"><label>Status</label><select class="input" onchange="RF.st=this.value;recDraw()"><option value="">All</option><option>Paid</option><option>Partial</option><option>Unpaid</option></select></div>':''}<div class="field"><label>&nbsp;</label><button class="btn" onclick="go('${type}-r')">Clear</button></div></div></details>
 <div class="card"><div class="tw" id="r_tbl"></div></div>`,()=>{RDRAW=recDraw;recDraw()}]}

function viewDoc(id){
 const d=S.docs.find(x=>x.id===id);if(!d)return;
 const c=DT[d.doc_type],isT=d.doc_type==='transfer',isP=!!c.pay,tot=dt(d),paid=d.paid||0,
  ps=(d.payments||[]).slice().sort((a,b)=>(a.pay_date||'').localeCompare(b.pay_date||''));
 openModal(`<div class="mbox" style="max-width:640px"><h3>${c.t} ${esc(d.doc_no)} ${isP?pBadge(pst(d)):''}</h3>
 <div class="row"><span>Date</span><b>${d.doc_date}</b></div>
 <div class="row"><span>${isT?'From → To':c.pl}</span><b>${isT?esc(ln(d.location_id))+' → '+esc(ln(d.to_location_id)):esc(d.partner||'-')}</b></div>
 ${isT?'':`<div class="row"><span>Location</span><b>${esc(ln(d.location_id))}</b></div>`}
 ${d.note?`<div class="row"><span>Note</span><b>${esc(d.note)}</b></div>`:''}
 <div class="tw" style="margin-top:12px"><table><thead><tr><th>#</th><th>Code</th><th>Description</th><th class="num">Qty</th>${isT?'':'<th class="num">Price</th><th class="num">Amount</th>'}</tr></thead><tbody>${d.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.code)}</td><td style="white-space:normal">${esc(l.desc)}</td><td class="num">${fmt(l.qty)}</td>${isT?'':`<td class="num">${fmt(l.price)}</td><td class="num">${fmt(l.qty*l.price)}</td>`}</tr>`).join('')}</tbody></table></div>
 ${isT?'':`<div class="tot"><span>Total</span><span>${fmt(tot)}</span> Ks</div>`}
 ${isP?`<div class="row"><span>Paid</span><b>${fmt(paid)} Ks</b></div><div class="row"><span>Balance</span><b>${fmt(tot-paid)} Ks</b></div>
  ${ps.length?`<div class="tw"><table><thead><tr><th>Payment date</th><th class="num">Amount</th><th>Method</th><th>Note</th></tr></thead><tbody>${ps.map(x=>`<tr><td>${x.pay_date||''}</td><td class="num">${fmt(x.amount)}</td><td>${esc(x.method||'')}</td><td style="white-space:normal">${esc(x.note||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mu" style="margin-top:8px">No payments yet.</p>'}`:''}
 <div class="mact" style="margin-top:12px"><button class="btn" onclick="printDoc(S.docs.find(x=>x.id==='${d.id}'))">Print</button>${canEd()?`<button class="btn" onclick="mclose();go('${d.doc_type}','${d.id}')">Edit</button>`:''}<button class="btn primary" onclick="mclose()">Close</button></div></div>`)}

async function docDel(id){
 const d=S.docs.find(x=>x.id===id);if(!d)return;
 if(!canEd())return toast('You do not have permission to delete.');
 const np=(d.payments||[]).length;
 if(!confirm('Delete '+d.doc_no+'?'+(np?' Its '+np+' payment record(s) will be deleted too.':'')+' Stock will change back.'))return;
 const keep=S.docs;S.docs=keep.filter(x=>x.id!==id);const bad=neg();S.docs=keep;
 if(bad)return toast('Cannot delete, stock would go negative: '+bad);
 const {data,error}=await sb.from('documents').delete().eq('id',id).select('id');
 if(error)return toast(dErr(error));
 if(!data||!data.length)return toast('You do not have permission to delete this.');
 S.docs=S.docs.filter(x=>x.id!==id);toast('Deleted');recDraw()}

V['sale-r']=()=>recPage('sale');V['sret-r']=()=>recPage('sret');V['purchase-r']=()=>recPage('purchase');
V['pret-r']=()=>recPage('pret');V['transfer-r']=()=>recPage('transfer');
addNav('Sales','sale-r','Sale Records','sale');
addNav('Sales','sret-r','Return Records','sret');
addNav('Purchase','purchase-r','Purchase Records','purchase');
addNav('Purchase','pret-r','Return Records','pret');
addNav('Inventory','transfer-r','Transfer Records','transfer');

const NAVORD=['sale','sale-r','sret','sret-r','customers','purchase','purchase-r','pret','pret-r','suppliers','products','transfer','transfer-r','locations'];
function sortNav(){NAV.forEach(g=>g.items.sort((a,b)=>{const x=NAVORD.indexOf(a[0]),y=NAVORD.indexOf(b[0]);return(x<0?99:x)-(y<0?99:y)}))}
sortNav();
