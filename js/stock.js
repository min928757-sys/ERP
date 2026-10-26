'use strict';
/* Stage 4b: Stock Balance, Stock In / Out */
const stockAll=()=>{const m=me();return m.role==='owner'||!m.perms||m.perms.includes('stock_all')||!ALW()};
const canAdj=()=>{const m=me();return !readOnly()&&(m.role==='owner'||(m.role==='manager'&&can('adjust')))};
const byCode=(a,b)=>String(a.code||'').localeCompare(String(b.code||''),undefined,{numeric:true});

/* ---------- Stock Balance ---------- */
let SB={q:'',low:false,hide:false};
function sbLocs(){let L=stockAll()?S.locations:vLocs();if(LF)L=L.filter(l=>l.id===LF);return L}
function sbDraw(){
 const el=$('#st_tbl');if(!el)return;
 const s=stock(),L=sbLocs(),q=SB.q.trim().toLowerCase(),many=L.length>1,tot=c=>L.reduce((a,l)=>a+((s[c]||{})[l.id]||0),0);
 const rows=S.products.slice().sort(byCode).filter(p=>!q||((p.code||'')+' '+(p.description||'')).toLowerCase().includes(q))
  .map(p=>({p,t:tot(p.code)})).filter(x=>(!SB.low||x.t<=x.p.min_stock)&&(!SB.hide||x.t!==0));
 $('#st_sum').textContent=rows.length+' products · stock value '+fmt(rows.reduce((a,x)=>a+x.t*x.p.purchase_price,0))+' Ks';
 const cols=L.length+(many?1:0)+3;
 el.innerHTML=`<table><thead><tr><th>Code</th><th>Description</th>${L.map(l=>`<th class="num">${esc(l.name)}</th>`).join('')}${many?'<th class="num">Total</th>':''}<th class="num">Value</th></tr></thead><tbody>
 ${rows.slice(0,300).map(({p,t})=>`<tr><td>${esc(p.code)}</td><td style="white-space:normal">${esc(p.description)}${t<=p.min_stock?' <span class="badge bad">Low</span>':''}</td>${L.map(l=>`<td class="num">${fmt((s[p.code]||{})[l.id])}</td>`).join('')}${many?`<td class="num"><b>${fmt(t)}</b></td>`:''}<td class="num">${fmt(t*p.purchase_price)}</td></tr>`).join('')||`<tr><td colspan="${cols}" class="empty">No products found.</td></tr>`}
 ${rows.length>300?`<tr><td colspan="${cols}" class="empty">Showing the first 300 of ${rows.length}. Use the filter to narrow down.</td></tr>`:''}</tbody></table>`}
V.stock=()=>{
 SB={q:'',low:false,hide:false};const ck='display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px';
 return['Stock Balance',`<div class="page-head">${locSelHtml()}<b id="st_sum"></b></div>
 <details class="card"><summary style="padding:13px 18px;cursor:pointer;font-weight:600">Filter</summary><div class="card-b hg">
  <div class="field"><label>Product code or description</label><input class="input" oninput="SB.q=this.value;sbDraw()"></div>
  <div class="field"><label>&nbsp;</label><label style="${ck}"><input type="checkbox" onchange="SB.low=this.checked;sbDraw()"> Low stock only</label></div>
  <div class="field"><label>&nbsp;</label><label style="${ck}"><input type="checkbox" onchange="SB.hide=this.checked;sbDraw()"> Hide zero stock</label></div></div></details>
 <div class="card"><div class="tw" id="st_tbl"></div></div>`,()=>{RDRAW=sbDraw;sbDraw()}]};
addNav('Inventory','stock','Stock Balance');

/* ---------- Stock In / Stock Out ---------- */
const ADJR={sin:['Opening stock','Found / returned','Count correction','Other'],sout:['Damaged','Expired','Lost / missing','Own use','Count correction','Other']};
let ADJ=null,AF={f:'',t:'',k:'',r:'',p:''},ABUSY=false;
D.sin.t='Stock In';D.sout.t='Stock Out';

V.adj=()=>{
 if(!canAdj())return['Stock In / Stock Out','<div class="empty">Only the owner or a manager can add Stock In / Stock Out.</div>'];
 const locs=vLocs();
 ADJ={kind:'sin',date:today(),loc:(LF&&locs.some(l=>l.id===LF)?LF:(locs[0]||{}).id)||'',reason:ADJR.sin[0],note:'',lines:[]};
 return['Stock In / Stock Out',`<div class="card"><div class="card-b hg">
  <div class="field"><label>Type</label><select class="input" onchange="adjKind(this.value)"><option value="sin">Stock In (add stock)</option><option value="sout">Stock Out (remove stock)</option></select></div>
  <div class="field"><label>Date</label><input class="input" type="date" value="${ADJ.date}" onchange="ADJ.date=this.value"></div>
  <div class="field"><label>Location</label><select class="input" onchange="ADJ.loc=this.value;adjPick()">${lopt(locs,ADJ.loc)}</select></div>
  <div class="field"><label>Reason</label><select class="input" id="ad_r" onchange="ADJ.reason=this.value">${ADJR.sin.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div>
  <div class="field"><label>Note</label><input class="input" oninput="ADJ.note=this.value"></div></div></div>
 <div class="card"><div class="card-b hg"><datalist id="ad_pl">${S.products.map(p=>`<option value="${esc(p.code)}">${esc(p.description)}</option>`).join('')}</datalist>
  <div class="field"><label>Product code</label><input class="input" id="ad_c" list="ad_pl" autocomplete="off" oninput="adjPick()"></div>
  <div class="field"><label>Description <small id="ad_av" style="color:var(--ok)"></small></label><input class="input" id="ad_ds" readonly></div>
  <div class="field"><label>Qty</label><input class="input" id="ad_q" type="number" min="0" step="any" inputmode="decimal" value="1"></div>
  <div class="field"><label>&nbsp;</label><button class="btn primary" onclick="adjAdd()">+ Add</button></div></div></div>
 <div class="card"><div class="tw" id="ad_lines"></div><div class="tot"><span>Total qty</span><span id="ad_tot">0</span></div></div>
 <div style="display:flex;justify-content:flex-end"><button class="btn ok" id="ad_save" onclick="adjSave()">Save</button></div>`,drawAdj]};
function adjKind(k){ADJ.kind=k;ADJ.reason=ADJR[k][0];$('#ad_r').innerHTML=ADJR[k].map(r=>`<option>${esc(r)}</option>`).join('')}
function adjPick(){
 const p=pByCode($('#ad_c').value);$('#ad_ds').value=p?p.description:'';
 $('#ad_av').textContent=p&&ADJ.loc?'(stock here: '+fmt((stock()[p.code]||{})[ADJ.loc]||0)+')':''}
function adjAdd(){
 const p=pByCode($('#ad_c').value),q=+$('#ad_q').value;
 if(!p)return toast('Choose a valid product code');if(!(q>0))return toast('Enter a quantity');
 const ex=ADJ.lines.find(l=>l.code===p.code);
 if(ex)ex.qty=R2(ex.qty+q);else ADJ.lines.push({code:p.code,desc:p.description,qty:q,cost:+p.purchase_price||0});
 $('#ad_c').value='';$('#ad_q').value=1;$('#ad_ds').value='';adjPick();drawAdj();$('#ad_c').focus()}
function drawAdj(){
 const el=$('#ad_lines');if(!el||!ADJ)return;
 el.innerHTML=`<table><thead><tr><th>#</th><th>Code</th><th>Description</th><th class="num">Qty</th><th></th></tr></thead><tbody>${ADJ.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.code)}</td><td style="white-space:normal">${esc(l.desc)}</td><td class="num">${fmt(l.qty)}</td><td class="act"><button class="btn sm d" onclick="ADJ.lines.splice(${i},1);drawAdj()">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No items yet.</td></tr>'}</tbody></table>`;
 $('#ad_tot').textContent=fmt(ADJ.lines.reduce((a,l)=>a+l.qty,0))}
async function adjSave(){
 if(ABUSY)return;
 if(!canAdj())return toast('Only the owner or a manager can do this.');
 if(!ADJ.loc)return toast('Choose a location');
 if(!ADJ.lines.length)return toast('Add at least one item');
 const keep=S.docs;S.docs=[...keep,{doc_type:ADJ.kind,location_id:ADJ.loc,doc_no:'~new',doc_date:ADJ.date,lines:ADJ.lines.map(l=>({code:l.code,qty:l.qty,price:0}))}];
 const bad=neg();S.docs=keep;if(bad)return toast('Not enough stock: '+bad);
 ABUSY=true;const b=$('#ad_save');if(b)b.disabled=true;
 try{
  const r=await sb.from('documents').insert({tenant_id:T,doc_type:ADJ.kind,doc_no:'',doc_date:ADJ.date,partner:null,location_id:ADJ.loc,to_location_id:null,note:ADJ.note||null,reason:ADJ.reason}).select().single();
  if(r.error)throw r.error;
  const l=await sb.from('document_lines').insert(ADJ.lines.map(x=>({tenant_id:T,document_id:r.data.id,product_code:x.code,description:x.desc,qty:x.qty,price:0,cost:x.cost})));
  if(l.error){await sb.from('documents').delete().eq('id',r.data.id);throw l.error}
  await load();toast('Saved '+r.data.doc_no);go('adj-r')
 }catch(e){toast(dErr(e))}
 finally{ABUSY=false;const b2=$('#ad_save');if(b2)b2.disabled=false}}

/* ---------- adjustment records ---------- */
function adjRows(){
 const p=AF.p.trim().toLowerCase();
 return S.docs.filter(d=>(d.doc_type==='sin'||d.doc_type==='sout')&&(!LF||d.location_id===LF))
  .filter(d=>(!AF.f||d.doc_date>=AF.f)&&(!AF.t||d.doc_date<=AF.t)&&(!AF.k||d.doc_type===AF.k)&&(!AF.r||d.reason===AF.r)&&(!p||d.lines.some(l=>((l.code||'')+' '+(l.desc||'')).toLowerCase().includes(p))))
  .sort((a,b)=>b.doc_date.localeCompare(a.doc_date)||String(b.doc_no).localeCompare(String(a.doc_no),undefined,{numeric:true}))}
function adjDraw(){
 const rows=adjRows(),val=d=>d.lines.reduce((a,l)=>a+l.qty*(l.cost||0),0),W=canEd()&&canAdj();
 $('#adj_sum').textContent=rows.length+' records';
 $('#adj_b').innerHTML=rows.slice(0,300).map(d=>`<tr><td><b>${esc(d.doc_no)}</b></td><td>${d.doc_date}</td><td>${d.doc_type==='sin'?'<span class="badge ok">Stock In</span>':'<span class="badge bad">Stock Out</span>'}</td><td>${esc(ln(d.location_id))}</td><td>${esc(d.reason||'')}</td><td class="num">${d.lines.length}</td><td class="num">${fmt(d.lines.reduce((a,l)=>a+l.qty,0))}</td><td class="num">${fmt(val(d))}</td><td class="act"><button class="btn sm" title="View" aria-label="View" onclick="adjView('${d.id}')">${svg('eye')}</button>${W?`<button class="btn sm d" onclick="adjDel('${d.id}')">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">No records.</td></tr>'}
V['adj-r']=()=>{
 AF={f:'',t:'',k:'',r:'',p:''};const rs=[...new Set([...ADJR.sin,...ADJR.sout])];
 return['Stock Adjustment Records',`<div class="page-head">${locSelHtml()}<div style="display:flex;gap:12px;align-items:center"><b id="adj_sum"></b>${canAdj()?`<button class="btn primary" onclick="go('adj')">+ New</button>`:''}</div></div>
 <details class="card"><summary style="padding:13px 18px;cursor:pointer;font-weight:600">Filter</summary><div class="card-b hg">
  <div class="field"><label>From</label><input class="input" type="date" onchange="AF.f=this.value;adjDraw()"></div>
  <div class="field"><label>To</label><input class="input" type="date" onchange="AF.t=this.value;adjDraw()"></div>
  <div class="field"><label>Type</label><select class="input" onchange="AF.k=this.value;adjDraw()"><option value="">All</option><option value="sin">Stock In</option><option value="sout">Stock Out</option></select></div>
  <div class="field"><label>Reason</label><select class="input" onchange="AF.r=this.value;adjDraw()"><option value="">All</option>${rs.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div>
  <div class="field"><label>Product code or description</label><input class="input" oninput="AF.p=this.value;adjDraw()"></div></div></details>
 <div class="card"><div class="tw"><table><thead><tr><th>No.</th><th>Date</th><th>Type</th><th>Location</th><th>Reason</th><th class="num">Items</th><th class="num">Qty</th><th class="num">Cost value</th><th></th></tr></thead><tbody id="adj_b"></tbody></table></div></div>`,()=>{RDRAW=adjDraw;adjDraw()}]};
function adjView(id){
 const d=S.docs.find(x=>x.id===id);if(!d)return;const v=d.lines.reduce((a,l)=>a+l.qty*(l.cost||0),0);
 openModal(`<div class="mbox" style="max-width:620px"><h3>${D[d.doc_type].t} ${esc(d.doc_no)}</h3>
 <div class="row"><span>Date</span><b>${d.doc_date}</b></div><div class="row"><span>Location</span><b>${esc(ln(d.location_id))}</b></div><div class="row"><span>Reason</span><b>${esc(d.reason||'-')}</b></div>${d.note?`<div class="row"><span>Note</span><b>${esc(d.note)}</b></div>`:''}
 <div class="tw" style="margin-top:12px"><table><thead><tr><th>Code</th><th>Description</th><th class="num">Qty</th><th class="num">Cost</th><th class="num">Value</th></tr></thead><tbody>${d.lines.map(l=>`<tr><td>${esc(l.code)}</td><td style="white-space:normal">${esc(l.desc)}</td><td class="num">${fmt(l.qty)}</td><td class="num">${fmt(l.cost||0)}</td><td class="num">${fmt(l.qty*(l.cost||0))}</td></tr>`).join('')}</tbody></table></div>
 <div class="tot"><span>Cost value</span><span>${fmt(v)}</span> Ks</div>
 <div class="mact"><button class="btn" onclick="prtAdj('${id}')">Print</button><button class="btn primary" onclick="mclose()">Close</button></div></div>`)}
function prtAdj(id){
 const d=S.docs.find(x=>x.id===id);if(!d)return;
 $('#print').innerHTML=`<h2>${esc(me().name||'')}</h2><h3>${D[d.doc_type].t}</h3><p>No: ${esc(d.doc_no)} &nbsp; Date: ${d.doc_date}</p><p>Location: ${esc(ln(d.location_id))} &nbsp; Reason: ${esc(d.reason||'-')}</p>
 <table><thead><tr><th>#</th><th>Code</th><th>Description</th><th>Qty</th></tr></thead><tbody>${d.lines.map((l,i)=>`<tr><td>${i+1}</td><td>${esc(l.code)}</td><td>${esc(l.desc)}</td><td>${fmt(l.qty)}</td></tr>`).join('')}</tbody></table><p>${esc(d.note||'')}</p><div class="sign"><span>Prepared by</span><span>Approved by</span></div>`;
 window.print()}
async function adjDel(id){
 if(!canEd()||!canAdj())return toast('You do not have permission to delete.');
 if(!confirm('Delete this record? Stock will change back.'))return;
 const keep=S.docs;S.docs=keep.filter(d=>d.id!==id);const bad=neg();S.docs=keep;
 if(bad)return toast('Cannot delete, stock would go negative: '+bad);
 const {data,error}=await sb.from('documents').delete().eq('id',id).select('id');
 if(error)return toast(dErr(error));
 if(!data||!data.length)return toast('Not allowed: only the owner or a manager with Edit permission can delete this.');
 S.docs=S.docs.filter(x=>x.id!==id);toast('Deleted');adjDraw()}
addNav('Inventory','adj','Stock In / Out','adjust');
addNav('Inventory','adj-r','Adjustment Records');

/* final menu order */
NAVORD.splice(0,NAVORD.length,'sale','sale-r','recv','sret','sret-r','customers','purchase','purchase-r','pay','pret','pret-r','suppliers','products','stock','transfer','transfer-r','adj','adj-r','locations');
sortNav();
