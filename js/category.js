'use strict';
/* Stage 11: product categories (Product Master, Stock Balance, Records, Excel, Backup) */
S.pcats=[];S.catOff=false;
const PFX=[];                                   /* extra product fields, used by later stages */
function pfIsSvc(p){return false}
function stkProducts(){return S.products}
const pfCatName=id=>{const c=S.pcats.find(x=>x.id===id);return c?c.name:''};
const catMatch=(p,c)=>c==='_none'?!p.category_id:p.category_id===c;
const catSorted=()=>S.pcats.slice().sort((a,b)=>a.name.localeCompare(b.name));
const catOpts=sel=>catSorted().map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');
const pcOn=()=>!S.catOff;

/* categories are read together with the rest of the shop data */
const _load11=load;
load=async function(){
 const ok=await _load11();if(!ok)return false;
 const r=await sb.from('product_categories').select('*').eq('tenant_id',T).order('name');
 if(r.error){S.catOff=true;S.pcats=[];if(!S.catWarned){S.catWarned=1;toast('Product categories are not set up yet (run the SQL).')}}
 else{S.catOff=false;S.pcats=r.data}
 return true};

/* ---------- category list: add, rename, delete ---------- */
async function pcAdd(name){
 name=(name||'').trim();
 if(!name){toast('Enter a name');return null}
 if(name.length>60){toast('The name is too long (60 characters at most)');return null}
 if(S.pcats.some(c=>c.name.toLowerCase()===name.toLowerCase())){toast('This category already exists.');return null}
 const {data,error}=await sb.from('product_categories').insert({tenant_id:T,name}).select().single();
 if(error){toast(error.code==='23505'?'This category already exists.':mdErr(error));return null}
 S.pcats.push(data);return data}
function pcMgr(){
 if(!mdW()||!pcOn())return;
 const un=S.products.filter(p=>!p.category_id).length;
 openModal(`<div class="mbox"><h3>Product categories</h3>
 ${catSorted().map(c=>`<div class="row"><span>${esc(c.name)} <span class="mu">(${S.products.filter(p=>p.category_id===c.id).length})</span></span><span><button class="btn sm" onclick="pcRename('${c.id}')">Rename</button> <button class="btn sm d" onclick="pcDel('${c.id}')">Delete</button></span></div>`).join('')||'<p class="mu">No categories yet.</p>'}
 <p class="mu" style="margin:8px 0">Uncategorised products: ${un}</p>
 <div class="field" style="margin-top:8px"><label>New category</label><input class="input" id="pc_n" maxlength="60"></div>
 <div class="mact"><button class="btn" onclick="mclose();go('products')">Close</button><button class="btn primary" onclick="pcAddBtn()">Add</button></div></div>`)}
async function pcAddBtn(){const c=await pcAdd($('#pc_n').value);if(c){toast('Added');pcMgr()}}
async function pcRename(id){
 const c=S.pcats.find(x=>x.id===id);if(!c)return;
 const n=(prompt('Rename category:',c.name)||'').trim();if(!n||n===c.name)return;
 if(n.length>60)return toast('The name is too long (60 characters at most)');
 if(S.pcats.some(x=>x.id!==id&&x.name.toLowerCase()===n.toLowerCase()))return toast('This category already exists.');
 const {data,error}=await sb.from('product_categories').update({name:n}).eq('id',id).select();
 if(error)return toast(error.code==='23505'?'This category already exists.':mdErr(error));
 if(!data.length)return toast('You do not have permission to do this.');
 c.name=n;toast('Saved');pcMgr()}
async function pcDel(id){
 const c=S.pcats.find(x=>x.id===id);if(!c)return;
 const n=S.products.filter(p=>p.category_id===id).length;
 if(!confirm('Delete "'+c.name+'"?'+(n?' Its '+n+' product(s) will become Uncategorised.':'')))return;
 const {data,error}=await sb.from('product_categories').delete().eq('id',id).select('id');
 if(error)return toast(mdErr(error));
 if(!data.length)return toast('You do not have permission to do this.');
 S.pcats=S.pcats.filter(x=>x.id!==id);
 S.products.forEach(p=>{if(p.category_id===id)p.category_id=null});
 toast('Deleted');pcMgr()}

/* ---------- Product Master ---------- */
let PF={q:'',cat:''},PFS=new Set(),PFB=false;
function pfRows(){
 const q=PF.q.trim().toLowerCase();
 return S.products.filter(p=>(!q||((p.code||'')+' '+(p.description||'')+' '+pfCatName(p.category_id)).toLowerCase().includes(q))&&(!PF.cat||catMatch(p,PF.cat))).sort(byCode)}
function pfBar(){
 const b=$('#pf_bar');if(!b)return;
 b.innerHTML=PFS.size?`<div class="card"><div class="card-b" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${PFS.size} selected</b><button class="btn sm primary" onclick="pfBulk()">Set category</button><button class="btn sm" onclick="PFS.clear();pfDraw();pfBar()">Clear</button></div></div>`:''}
function pfSel(id,on){if(on)PFS.add(id);else PFS.delete(id);pfBar()}
function pfAll(on){pfRows().slice(0,200).forEach(p=>{if(on)PFS.add(p.id);else PFS.delete(p.id)});pfDraw();pfBar()}
function pfDraw(){
 const el=$('#pf_t');if(!el)return;
 const W=mdW(),s=stock(),all=pfRows(),rows=all.slice(0,200),hc=pcOn()&&S.pcats.length>0;
 $('#pf_n').textContent=all.length+' product'+(all.length===1?'':'s');
 el.innerHTML=`<table><thead><tr>${W?`<th style="width:34px"><input type="checkbox" aria-label="Select all" onchange="pfAll(this.checked)" ${rows.length&&rows.every(p=>PFS.has(p.id))?'checked':''}></th>`:''}<th>Code</th><th>Description</th>${hc?'<th>Category</th>':''}<th class="num">Purchase price</th><th class="num">Sale price</th><th>Unit</th><th class="num">Min stock</th><th class="num">In stock</th><th></th></tr></thead><tbody>
 ${rows.map(p=>{const t=Object.values(s[p.code]||{}).reduce((a,b)=>a+b,0),svc=pfIsSvc(p);
  return`<tr>${W?`<td><input type="checkbox" aria-label="Select" ${PFS.has(p.id)?'checked':''} onchange="pfSel('${p.id}',this.checked)"></td>`:''}<td>${esc(p.code)}</td><td style="white-space:normal;min-width:140px">${esc(p.description)}</td>${hc?`<td>${p.category_id?esc(pfCatName(p.category_id)):'<span class="mu">-</span>'}</td>`:''}<td class="num">${fmt(p.purchase_price)}</td><td class="num">${fmt(p.sale_price)}</td><td>${esc(p.unit||'')}</td><td class="num">${fmt(p.min_stock)}</td><td class="num">${svc?'<span class="mu">no stock</span>':`<b>${fmt(t)}</b>${t<=p.min_stock?' <span class="badge bad">Low</span>':''}`}</td><td class="act">${W?`<button class="btn sm" onclick="pfForm('${p.id}')">Edit</button><button class="btn sm d" onclick="mdDel('products','${p.id}')">Delete</button>`:''}</td></tr>`}).join('')||`<tr><td colspan="12" class="empty">${PF.q||PF.cat?'Nothing found.':'No products yet.'}</td></tr>`}
 ${all.length>200?`<tr><td colspan="12" class="empty">Showing the first 200 of ${all.length}. Use the search box or the category filter to find the rest.</td></tr>`:''}</tbody></table>`}
function pfPage(){
 PF={q:'',cat:''};PFS=new Set();
 const hc=pcOn()&&S.pcats.length>0;
 return['Product Master',`<div class="page-head"><b id="pf_n"></b><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
  ${hc?`<select class="input" style="width:auto" onchange="PF.cat=this.value;pfDraw()"><option value="">All categories</option><option value="_none">Uncategorised</option>${catOpts('')}</select>`:''}
  <input class="input" style="width:220px" placeholder="Search code, name, category..." oninput="PF.q=this.value;pfDraw()">
  ${pcOn()&&mdW()?'<button class="btn" onclick="pcMgr()">Categories</button>':''}
  ${mdW()?'<button class="btn primary" onclick="pfForm()">+ Add new</button>':''}</div></div>
 <div id="pf_bar"></div><div class="card"><div class="tw" id="pf_t"></div></div>`,()=>{RDRAW=pfDraw;pfDraw();pfBar()}]}
V.products=pfPage;
const _mdForm11=mdForm;
mdForm=function(tbl,id){return tbl==='products'?pfForm(id):_mdForm11(tbl,id)};

function pfForm(id){
 if(!mdW())return toast('You do not have permission to change products.');
 const r=id?S.products.find(x=>x.id===id):{};if(!r)return;
 const num=(k,l)=>`<div class="field"><label>${l}</label><input class="input" id="pf_${k}" type="number" min="0" step="any" inputmode="decimal" value="${esc(r[k]??'')}"></div>`;
 openModal(`<div class="mbox"><h3>${id?'Edit':'Add'} product</h3>
 <div class="field"><label>Product code *</label><input class="input" id="pf_code" value="${esc(r.code||'')}" ${id?'readonly':''}></div>
 <div class="field"><label>Description *</label><input class="input" id="pf_description" value="${esc(r.description||'')}"></div>
 ${pcOn()?`<div class="field"><label>Category</label><select class="input" id="pf_category"><option value="">Uncategorised</option>${catOpts(r.category_id)}</select><button class="btn sm" style="margin-top:6px" onclick="pfQuickCat()">+ New category</button></div>`:''}
 ${PFX.map(x=>x.html(r)).join('')}
 ${num('purchase_price','Purchase price')}${num('sale_price','Sale price')}
 <div class="field"><label>Unit (pcs, box, kg...)</label><input class="input" id="pf_unit" value="${esc(r.unit||'')}"></div>
 ${num('min_stock','Minimum stock (low-stock warning)')}
 ${id?'<p class="mu" style="margin-bottom:8px">The product code cannot be changed because invoices use it.</p>':''}
 <div class="mact"><button class="btn" onclick="mclose()">Cancel</button><button class="btn primary" id="pf_save" onclick="pfSave('${id||''}')">Save</button></div></div>`)}
async function pfQuickCat(){
 const n=(prompt('New category name:')||'').trim();if(!n)return;
 const c=await pcAdd(n);if(!c)return;
 const s=$('#pf_category');if(s){s.insertAdjacentHTML('beforeend',`<option value="${c.id}">${esc(c.name)}</option>`);s.value=c.id}}
async function pfSave(id){
 if(PFB)return;
 const o={code:$('#pf_code').value.trim(),description:$('#pf_description').value.trim(),unit:$('#pf_unit').value.trim()};
 if(!o.code)return toast('Please fill: Product code');
 if(!o.description)return toast('Please fill: Description');
 for(const [k,l] of [['purchase_price','Purchase price'],['sale_price','Sale price'],['min_stock','Minimum stock']]){
  let v=$('#pf_'+k).value.trim();v=v===''?0:+v;
  if(!(v>=0))return toast(l+' must be a number, 0 or more');
  o[k]=v}
 if(pcOn())o.category_id=$('#pf_category').value||null;
 for(const x of PFX){const e=x.read(o,id);if(e)return toast(e)}
 if(S.products.some(x=>x.id!==id&&String(x.code).toLowerCase()===o.code.toLowerCase()))return toast('This code already exists.');
 PFB=true;
 try{
  const q=id?sb.from('products').update(o).eq('id',id):sb.from('products').insert({...o,tenant_id:T}),
   {data,error}=await q.select().single();
  if(error)throw error;
  S.products=id?S.products.map(x=>x.id===id?data:x):[...S.products,data];
  mclose();toast('Saved');go('products')
 }catch(e){toast(mdErr(e))}
 finally{PFB=false}}
function pfBulk(){
 if(!PFS.size)return;
 if(!S.pcats.length)return toast('Create a category first (use the Categories button).');
 openModal(`<div class="mbox"><h3>Set category for ${PFS.size} product(s)</h3><div class="field"><label>Category</label><select class="input" id="pb_c"><option value="">Uncategorised</option>${catOpts('')}</select></div><div class="mact"><button class="btn" onclick="mclose()">Cancel</button><button class="btn primary" onclick="pfBulkSave()">Apply</button></div></div>`)}
async function pfBulkSave(){
 if(PFB)return;
 const v=$('#pb_c').value||null,ids=[...PFS];PFB=true;
 try{
  for(let i=0;i<ids.length;i+=100){
   const part=ids.slice(i,i+100),{data,error}=await sb.from('products').update({category_id:v}).in('id',part).eq('tenant_id',T).select('id');
   if(error)throw error;
   if(data.length<part.length)throw new Error('You do not have permission to do this.')}
  S.products.forEach(p=>{if(PFS.has(p.id))p.category_id=v});
  PFS.clear();mclose();toast('Category set');pfDraw();pfBar()
 }catch(e){toast(mdErr(e));await load();pfDraw()}
 finally{PFB=false}}

/* ---------- Stock Balance: category filter and totals by category ---------- */
let SBC='';
sbDraw=function(){
 const el=$('#st_tbl');if(!el)return;
 const s=stock(),L=sbLocs(),q=SB.q.trim().toLowerCase(),many=L.length>1,tot=c=>L.reduce((a,l)=>a+((s[c]||{})[l.id]||0),0),
  base=stkProducts().slice().sort(byCode).filter(p=>!q||((p.code||'')+' '+(p.description||'')+' '+pfCatName(p.category_id)).toLowerCase().includes(q))
   .map(p=>({p,t:tot(p.code)})).filter(x=>(!SB.low||x.t<=x.p.min_stock)&&(!SB.hide||x.t!==0)),
  rows=base.filter(x=>!SBC||catMatch(x.p,SBC)),hc=pcOn()&&S.pcats.length>0,cols=L.length+(many?1:0)+3+(hc?1:0);
 $('#st_sum').textContent=rows.length+' products · stock value '+fmt(rows.reduce((a,x)=>a+x.t*x.p.purchase_price,0))+' Ks';
 const cb=$('#st_cat');
 if(cb){
  if(!hc)cb.innerHTML='';
  else{
   const sm={};
   base.forEach(x=>{const k=x.p.category_id||'_none',o=sm[k]=sm[k]||{id:k,name:k==='_none'?'Uncategorised':pfCatName(k),n:0,val:0};o.n++;o.val+=x.t*(+x.p.purchase_price||0)});
   const list=Object.values(sm).sort((a,b)=>a.name.localeCompare(b.name));
   cb.innerHTML=`<div class="card"><div class="card-h">By category</div><div class="tw"><table><thead><tr><th>Category</th><th class="num">Products</th><th class="num">Stock value</th><th></th></tr></thead><tbody>${list.map(x=>`<tr ${SBC===x.id?'style="background:#eef4ff"':''}><td><b>${esc(x.name)}</b></td><td class="num">${x.n}</td><td class="num">${fmt(x.val)}</td><td class="act"><button class="btn sm ${SBC===x.id?'primary':''}" onclick="sbCat('${x.id}')">${SBC===x.id?'Showing':'Show'}</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nothing to show.</td></tr>'}</tbody></table></div></div>`}}
 el.innerHTML=`<table><thead><tr><th>Code</th><th>Description</th>${hc?'<th>Category</th>':''}${L.map(l=>`<th class="num">${esc(l.name)}</th>`).join('')}${many?'<th class="num">Total</th>':''}<th class="num">Value</th></tr></thead><tbody>
 ${rows.slice(0,300).map(({p,t})=>`<tr class="${t<=p.min_stock?'low':''}"><td>${esc(p.code)}</td><td style="white-space:normal">${esc(p.description)}${t<=p.min_stock?' <span class="badge bad">Low</span>':''}</td>${hc?`<td>${p.category_id?esc(pfCatName(p.category_id)):'<span class="mu">-</span>'}</td>`:''}${L.map(l=>`<td class="num">${fmt((s[p.code]||{})[l.id])}</td>`).join('')}${many?`<td class="num"><b>${fmt(t)}</b></td>`:''}<td class="num">${fmt(t*p.purchase_price)}</td></tr>`).join('')||`<tr><td colspan="${cols}" class="empty">No products found.</td></tr>`}
 ${rows.length>300?`<tr><td colspan="${cols}" class="empty">Showing the first 300 of ${rows.length}. Use the filter to narrow down.</td></tr>`:''}</tbody></table>`};
function sbCat(id){SBC=SBC===id?'':id;const s=$('#sbc_sel');if(s)s.value=SBC;sbDraw()}
V.stock=()=>{
 SB={q:'',low:false,hide:false};SBC='';
 const ck='display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px',hc=pcOn()&&S.pcats.length>0;
 return['Stock Balance',`<div class="page-head">${locSelHtml()}<b id="st_sum"></b></div>
 <details class="card"><summary style="padding:13px 18px;cursor:pointer;font-weight:600">Filter</summary><div class="card-b hg">
  <div class="field"><label>Product code or description</label><input class="input" oninput="SB.q=this.value;sbDraw()"></div>
  ${hc?`<div class="field"><label>Category</label><select class="input" id="sbc_sel" onchange="SBC=this.value;sbDraw()"><option value="">All</option><option value="_none">Uncategorised</option>${catOpts('')}</select></div>`:''}
  <div class="field"><label>&nbsp;</label><label style="${ck}"><input type="checkbox" onchange="SB.low=this.checked;sbDraw()"> Low stock only</label></div>
  <div class="field"><label>&nbsp;</label><label style="${ck}"><input type="checkbox" onchange="SB.hide=this.checked;sbDraw()"> Hide zero stock</label></div></div></details>
 <div id="st_cat"></div><div class="card"><div class="tw" id="st_tbl"></div></div>`,()=>{RDRAW=sbDraw;sbDraw()}]};

/* ---------- Records: product category filter ---------- */
let RCAT='';
const _rr12=recRows;
recRows=function(){
 const rows=_rr12();
 if(!RCAT)return rows;
 return rows.filter(x=>x.d.lines.some(l=>catMatch(P(l.code),RCAT)))};
const _rd12=recDraw;
recDraw=function(){
 _rd12();
 if(!RCAT)return;
 let q=0,a=0;
 recRows().forEach(x=>x.d.lines.forEach(l=>{if(catMatch(P(l.code),RCAT)){q+=l.qty;a+=l.qty*(l.price||0)}}));
 const t=$('#r_tiles');
 if(t)t.insertAdjacentHTML('beforeend','<div class="card kpi"><div class="mu">Items in category</div><div class="val" style="font-size:19px">'+fmt(q)+' qty'+(RT==='transfer'?'':' · '+fmt(a)+' Ks')+'</div></div>')};
const _rp12=recPage;
recPage=function(type){
 RCAT='';const r=_rp12(type);
 if(pcOn()&&S.pcats.length)
  r[1]=r[1].replace('<div class="field"><label>&nbsp;</label><button class="btn" onclick="go(','<div class="field"><label>Product category</label><select class="input" onchange="RCAT=this.value;recDraw()"><option value="">All</option><option value="_none">Uncategorised</option>'+catOpts('')+'</select></div><div class="field"><label>&nbsp;</label><button class="btn" onclick="go(');
 return r};

/* ---------- Excel: a Category column ---------- */
function xlCat(name,idx){
 const f=SH[name];if(!f)return;
 SH[name]=()=>{
  const r=f();if(!r.length||r[0][idx]!=='Code')return r;
  return r.map((x,i)=>i===0?[...x,'Category']:[...x,pfCatName((P(x[idx])||{}).category_id)||'Uncategorised'])}}
xlCat('Products',0);xlCat('Stock Balance',0);xlCat('Sales Items',4);xlCat('Purchase Items',4);

/* ---------- Backup and Restore carry the categories ---------- */
xBackup=function(){
 const o={app:'retailpro',version:5,shop:me().name||'',exported_at:new Date().toISOString(),
  locations:S.locations,products:S.products.map(p=>({...p,category:pfCatName(p.category_id)})),customers:S.customers,suppliers:S.suppliers,expenses:S.expenses,
  expense_categories:S.xcats||[],product_categories:S.pcats.map(c=>({name:c.name})),
  documents:S.docs.map(d=>({id:d.id,doc_type:d.doc_type,doc_no:d.doc_no,doc_date:d.doc_date,partner:d.partner,location_id:d.location_id,to_location_id:d.to_location_id,note:d.note,reason:d.reason,
   lines:d.lines.map(l=>({code:l.code,desc:l.desc,qty:l.qty,price:l.price,cost:l.cost})),
   payments:(d.payments||[]).map(p=>({pay_date:p.pay_date,amount:p.amount,method:p.method,note:p.note,receipt_id:p.receipt_id})),
   ...(d.doc_type==='purchase'&&!S.grOff?{receipts:(d.receipts||[]).map(r=>({recv_date:r.recv_date,note:r.note,lines:r.lines}))}:{}),
   ...(d.doc_type==='sale'&&!S.dlOff?{deliveries:(d.deliveries||[]).map(r=>({deliver_date:r.deliver_date,note:r.note,lines:r.lines}))}:{})}))};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));
 a.download='retailpro_backup_'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
 try{localStorage.setItem('lastExport',new Date().toLocaleString())}catch(e){}toast('Backup downloaded')};
const _rs11=rsRun;
rsRun=async function(){
 const snap=RB;await _rs11();
 if(!snap||RB!==null||S.catOff)return;
 const names=new Set();
 (snap.b.product_categories||[]).forEach(c=>{if(c&&c.name)names.add(c.name)});
 snap.prod.forEach(p=>{if(p.category)names.add(p.category)});
 if(!names.size)return;
 try{
  const have=new Set(S.pcats.map(c=>c.name.toLowerCase())),
   add=[...names].filter(n=>!have.has(n.toLowerCase())).map(n=>({tenant_id:T,name:n}));
  if(add.length){const r=await sb.from('product_categories').insert(add);if(r.error)throw r.error}
  await load();
  const by=Object.fromEntries(S.pcats.map(c=>[c.name.toLowerCase(),c.id])),groups={};
  snap.prod.forEach(p=>{const id=p.category&&by[p.category.toLowerCase()];if(id)(groups[id]=groups[id]||[]).push(p.code)});
  for(const id in groups)for(let i=0;i<groups[id].length;i+=100){
   const r=await sb.from('products').update({category_id:id}).eq('tenant_id',T).in('code',groups[id].slice(i,i+100));
   if(r.error)throw r.error}
  await load();toast('Product categories restored')
 }catch(e){toast('Documents restored, but product categories could not be restored: '+mdErr(e))}};
