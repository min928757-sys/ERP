'use strict';
/* Stage 3a: create / edit invoices, returns and transfers */
const DT={
 sale:{t:'Sale Invoice',p:'customers',pl:'Customer',pr:'sale_price',pay:1},
 sret:{t:'Sale Return',p:'customers',pl:'Customer',pr:'sale_price'},
 purchase:{t:'Purchase Invoice',p:'suppliers',pl:'Supplier',pr:'purchase_price',pay:1},
 pret:{t:'Purchase Return',p:'suppliers',pl:'Supplier',pr:'purchase_price'},
 transfer:{t:'Stock Transfer'}};
const PM=['Cash','Bank transfer','KBZPay','Wave Pay','AYA Pay','Other'];
let CUR=null,SAVING=false;const EDC={};
document.head.insertAdjacentHTML('beforeend','<style>.tot{display:flex;justify-content:flex-end;gap:20px;padding:14px 18px;font-size:16px;font-weight:700;border-top:1px solid var(--ln)}</style>');

const pst=d=>{const t=dt(d),p=d.paid||0;return t-p<=0.0001?'Paid':p>0?'Partial':'Unpaid'};
const pBadge=s=>`<span class="badge ${s==='Paid'?'ok':s==='Partial'?'warn':'bad'}">${s}</span>`;
const canEd=()=>!readOnly()&&can('edit');
const dErr=e=>/row-level security/i.test(e.message||'')?'You do not have permission to do this.':e.code==='23505'?'This document number already exists. Please try again.':(e.message||String(e));
const pByCode=v=>{v=(v||'').trim().toLowerCase();return v?S.products.find(p=>String(p.code).toLowerCase()===v):null};
const lopt=(arr,v)=>arr.map(l=>`<option value="${l.id}" ${l.id===v?'selected':''}>${esc(l.name)}</option>`).join('');

function docForm(type,id){
 const c=DT[type],isT=type==='transfer',isP=!!c.pay,e=id?S.docs.find(d=>d.id===id):null;
 if(id&&!e)return['Not found','<div class="empty">Document not found.</div>'];
 if(readOnly())return[c.t,'<div class="empty">Your account is read-only, so documents cannot be created or changed.</div>'];
 if(id&&!canEd())return[c.t,'<div class="empty">You do not have permission to edit saved documents.</div>'];
 const locs=vLocs();
 const from=(e&&e.location_id)||(LF&&locs.some(l=>l.id===LF)?LF:(locs[0]||{}).id)||'';
 const other=S.locations.find(l=>l.id!==from);
 CUR=e?{id:e.id,doc_type:type,doc_no:e.doc_no,doc_date:e.doc_date,partner:e.partner||'',location_id:e.location_id,to_location_id:e.to_location_id||'',note:e.note||'',paid:e.paid||0,lines:e.lines.map(l=>({...l}))}
  :{doc_type:type,doc_date:today(),partner:(type==='sale'||type==='sret')?'Walk-in':'',location_id:from,to_location_id:other?other.id:'',note:'',pay:'Cash',paid:0,lines:[]};
 for(const k in EDC)delete EDC[k];
 const names=isT?[]:S[c.p].map(x=>x.name);
 if(!isT&&(type==='sale'||type==='sret')&&!names.includes('Walk-in'))names.unshift('Walk-in');
 if(!isT&&CUR.partner&&!names.includes(CUR.partner))names.push(CUR.partner);
 if(!isT&&!CUR.partner)CUR.partner=names[0]||'';
 const fromList=locs.some(l=>l.id===from)?locs:[...locs,...S.locations.filter(l=>l.id===from)];
 return[(e?'Edit ':'New ')+c.t,`<div class="page-head"><b>${e?esc(e.doc_no):''}</b><div style="display:flex;gap:10px"><button class="btn" onclick="docPrintCur()">Print</button><button class="btn ok" id="dsave" onclick="docSave()">Save</button></div></div>
 <div class="card"><div class="card-b hg">
  <div class="field"><label>Document no.</label><input class="input" id="df_no" readonly value="${e?esc(e.doc_no):''}"></div>
  <div class="field"><label>Date</label><input class="input" type="date" value="${CUR.doc_date}" onchange="CUR.doc_date=this.value"></div>
  ${isT?`<div class="field"><label>From location</label><select class="input" onchange="CUR.location_id=this.value;peek();docPick()">${lopt(fromList,CUR.location_id)}</select></div>
  <div class="field"><label>To location</label><select class="input" onchange="CUR.to_location_id=this.value;docPick()">${lopt(S.locations,CUR.to_location_id)}</select></div>`
  :`<div class="field"><label>${c.pl}</label><select class="input" onchange="CUR.partner=this.value">${names.map(n=>`<option value="${esc(n)}" ${n===CUR.partner?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
  <div class="field"><label>Location</label><select class="input" onchange="CUR.location_id=this.value;peek();docPick()">${lopt(fromList,CUR.location_id)}</select></div>`}
  ${isP&&!e?`<div class="field"><label>Payment</label><select class="input" onchange="CUR.pay=this.value">${PM.map(m=>`<option>${m}</option>`).join('')}<option value="Credit">Credit (unpaid)</option></select></div>`:''}
  ${isP&&e?`<div class="field"><label>Paid so far</label><input class="input" readonly value="${fmt(CUR.paid)} Ks"></div>`:''}
  <div class="field"><label>Note</label><input class="input" value="${esc(CUR.note)}" oninput="CUR.note=this.value"></div></div></div>
 <div class="card"><div class="card-b hg"><datalist id="dl_p">${S.products.map(p=>`<option value="${esc(p.code)}">${esc(p.description)}</option>`).join('')}</datalist>
  <div class="field"><label>Product code</label><input class="input" id="e_code" list="dl_p" autocomplete="off" oninput="docPick()"></div>
  <div class="field"><label>Description <small id="e_av" style="color:var(--ok)"></small></label><input class="input" id="e_desc" readonly></div>
  <div class="field"><label>Qty</label><input class="input" id="e_qty" type="number" min="0" step="any" inputmode="decimal" value="1"></div>
  ${isT?'':'<div class="field"><label>Price</label><input class="input" id="e_price" type="number" min="0" step="any" inputmode="decimal"></div>'}
  <div class="field"><label>&nbsp;</label><button class="btn primary" onclick="docAdd()">+ Add</button></div></div></div>
 <div class="card"><div class="tw" id="d_lines"></div><div class="tot${isT?' hidden':''}"><span>Total</span><span id="d_tot">0</span> Ks</div></div>`,()=>{docDraw();peek()}]}

async function peek(){
 if(!CUR||CUR.id||!CUR.location_id)return;
 const {data}=await sb.rpc('peek_doc_no',{p_tenant:T,p_type:CUR.doc_type,p_loc:CUR.location_id});
 const el=$('#df_no');if(el&&!CUR.id)el.value=data||''}

function docPick(){
 const p=pByCode($('#e_code').value);$('#e_desc').value=p?p.description:'';
 const pr=$('#e_price');if(pr&&p)pr.value=p[DT[CUR.doc_type].pr];
 const av=$('#e_av');if(!av)return;
 if(!p||!CUR.location_id){av.textContent='';return}
 const s=stock()[p.code]||{},a=fmt(s[CUR.location_id]||0);
 av.textContent=CUR.doc_type==='transfer'?'(here: '+a+(CUR.to_location_id?' · destination: '+fmt(s[CUR.to_location_id]||0):'')+')':'(stock here: '+a+')'}

function docAdd(){
 const p=pByCode($('#e_code').value),q=+$('#e_qty').value,t=CUR.doc_type,isT=t==='transfer';
 if(!p)return toast('Choose a valid product code');
 if(!(q>0))return toast('Enter a quantity');
 let price=0;
 if(!isT){const raw=$('#e_price').value;price=+raw;if(raw===''||!(price>=0))return toast('Enter a price')}
 let cost=(t==='purchase'||t==='pret')?price:(+p.purchase_price||0);
 if(EDC[p.code]!==undefined){cost=EDC[p.code];delete EDC[p.code]}
 const ex=CUR.lines.find(l=>l.code===p.code);
 if(ex){ex.qty=R2(ex.qty+q);ex.price=price;ex.cost=cost;ex.desc=p.description}
 else CUR.lines.push({code:p.code,desc:p.description,qty:q,price,cost});
 $('#e_code').value='';$('#e_qty').value=1;$('#e_desc').value='';const pe=$('#e_price');if(pe)pe.value='';
 docPick();docDraw();$('#e_code').focus()}

function docEditLine(i){
 const l=CUR.lines.splice(i,1)[0];EDC[l.code]=l.cost;
 $('#e_code').value=l.code;docPick();$('#e_qty').value=l.qty;
 const pe=$('#e_price');if(pe)pe.value=l.price;docDraw();$('#e_qty').focus()}

function docDraw(){
 const isT=CUR.doc_type==='transfer';
 $('#d_lines').innerHTML=`<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th class="num">Qty</th>${isT?'':'<th class="num">Price</th><th class="num">Amount</th>'}<th></th></tr></thead><tbody>${CUR.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.code)}</td><td style="white-space:normal">${esc(l.desc)}</td><td class="num">${fmt(l.qty)}</td>${isT?'':`<td class="num">${fmt(l.price)}</td><td class="num">${fmt(l.qty*l.price)}</td>`}<td class="act"><button class="btn sm" onclick="docEditLine(${i})">Edit</button><button class="btn sm d" onclick="CUR.lines.splice(${i},1);docDraw()">Delete</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No items yet.</td></tr>'}</tbody></table>`;
 const tt=$('#d_tot');if(tt)tt.textContent=fmt(R2(dt(CUR)))}

async function docSave(){
 if(SAVING)return;
 const t=CUR.doc_type,c=DT[t],isT=t==='transfer',isP=!!c.pay;
 if(!CUR.lines.length)return toast('Add at least one item');
 if(!CUR.doc_date)return toast('Choose a date');
 if(!CUR.location_id)return toast('Choose a location');
 if(isT){
  if(!CUR.to_location_id)return toast('Choose the destination');
  if(CUR.to_location_id===CUR.location_id)return toast('From and To must be different')}
 else if(!CUR.partner)return toast('Choose a '+c.pl.toLowerCase()+' (add one first if the list is empty)');
 const total=R2(dt(CUR));
 if(CUR.id&&isP&&R2(CUR.paid)>total+0.005)return toast('The total is less than the amount already paid ('+fmt(CUR.paid)+' Ks). Change the payment first.');
 const keep=S.docs;S.docs=[...keep.filter(d=>d.id!==CUR.id),{...CUR,doc_no:CUR.doc_no||'~new'}];
 const bad=neg();S.docs=keep;
 if(bad)return toast('Not enough stock: '+bad);
 SAVING=true;const btn=$('#dsave');if(btn)btn.disabled=true;
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
  }
  if(!await load())throw new Error('Saved, but the data could not be reloaded. Please refresh.');
  const doc=S.docs.find(d=>d.id===id);
  toast('Saved '+no);
  if(doc&&confirm('Saved '+no+'. Print now?'))printDoc(doc);
  go(t+'-r');
 }catch(e){toast(dErr(e))}
 finally{SAVING=false;const b=$('#dsave');if(b)b.disabled=false}}

function docPrintCur(){
 if(!CUR||!CUR.lines.length)return toast('Add at least one item first');
 printDoc({...CUR,doc_no:CUR.doc_no||'(not saved yet)',payments:[]})}

function printDoc(d){
 const c=DT[d.doc_type],isT=d.doc_type==='transfer',isP=!!c.pay,tot=dt(d),paid=d.paid||0;
 $('#print').innerHTML=`<h2>${esc(me().name||'')}</h2><h3>${c.t}</h3><p>No: ${esc(d.doc_no||'')} &nbsp; Date: ${d.doc_date}</p>
 <p>${isT?'From: '+esc(ln(d.location_id))+' &nbsp; To: '+esc(ln(d.to_location_id)):c.pl+': '+esc(d.partner||'')+' &nbsp; Location: '+esc(ln(d.location_id))}</p>
 <table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th>${isT?'':'<th>Price</th><th>Amount</th>'}</tr></thead><tbody>${d.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.code)}</td><td>${esc(l.desc)}</td><td>${fmt(l.qty)}</td>${isT?'':`<td>${fmt(l.price)}</td><td>${fmt(l.qty*l.price)}</td>`}</tr>`).join('')}</tbody></table>
 ${isT?'':`<h3 style="text-align:right">Total: ${fmt(tot)} Ks</h3>`}
 ${isP?`<p style="text-align:right">Paid: ${fmt(paid)} Ks &nbsp; Balance: ${fmt(tot-paid)} Ks</p>`:''}
 <p>${esc(d.note||'')}</p><div class="sign"><span>Prepared by</span><span>${isT?'Received by':c.pl}</span></div>`;
 window.print()}

V.sale=id=>docForm('sale',id);V.sret=id=>docForm('sret',id);V.purchase=id=>docForm('purchase',id);
V.pret=id=>docForm('pret',id);V.transfer=id=>docForm('transfer',id);
addNav('Sales','sale','New Sale Invoice','sale');
addNav('Sales','sret','Sale Return','sret');
addNav('Purchase','purchase','New Purchase Invoice','purchase');
addNav('Purchase','pret','Purchase Return','pret');
addNav('Inventory','transfer','New Stock Transfer','transfer');
