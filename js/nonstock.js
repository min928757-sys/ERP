'use strict';
/* Stage 12: non-stock items (services, delivery fees, made-to-order goods) */
S.nsOff=false;

/* is the item_type column there yet? */
const _load13=load;
load=async function(){
 const ok=await _load13();if(!ok)return false;
 const r=await sb.from('products').select('item_type').limit(1);
 S.nsOff=!!r.error;
 if(S.nsOff&&!S.nsWarned){S.nsWarned=1;toast('Non-stock items are not set up yet (run the SQL).')}
 return true};

pfIsSvc=function(p){return !S.nsOff&&!!p&&p.item_type==='nonstock'};
stkProducts=function(){return S.products.filter(p=>!pfIsSvc(p))};
const nsCodes=()=>new Set(S.products.filter(pfIsSvc).map(p=>p.code));
const withStockOnly=fn=>{const keep=S.products;S.products=keep.filter(p=>!pfIsSvc(p));try{return fn()}finally{S.products=keep}};

/* stock never contains a non-stock item, so "Not enough stock" is never raised for it */
const _stock13=stock;
stock=function(){
 const s=_stock13(),ns=nsCodes();
 if(ns.size)for(const c of ns)delete s[c];
 return s};

/* Dashboard: no low-stock warning or stock value for non-stock items */
const _dash13=V.dash;
V.dash=()=>withStockOnly(_dash13);

/* goods received / delivered: non-stock lines count as done */
function nsInfo(r){
 const stk=[];
 r.items.forEach(x=>{
  if(pfIsSvc(P(x.code))){x.pend=0;x.got=0;x.ns=true;if(String(x.desc).indexOf('(non-stock)')<0)x.desc=x.desc+' (non-stock)'}
  else stk.push(x)});
 r.to=stk.reduce((a,x)=>a+x.ord,0);
 r.tg=stk.reduce((a,x)=>a+Math.min(x.got,x.ord),0);
 r.st=!stk.length?'full':r.tg<=0.0001?'none':stk.every(x=>x.pend<=0.0001)?'full':'partial';
 return r}
const _grInfo13=grInfo,_dlInfo13=dlInfo;
grInfo=d=>nsInfo(_grInfo13(d));
dlInfo=d=>nsInfo(_dlInfo13(d));
/* a receipt or delivery never records non-stock lines */
const _grIns13=grInsert,_dlIns13=dlInsert;
grInsert=async function(docId,date,note,lines){
 const ls=lines.filter(l=>!pfIsSvc(P(l.code)));
 if(!ls.length)return null;
 return _grIns13(docId,date,note,ls)};
dlInsert=async function(docId,date,note,lines){
 const ls=lines.filter(l=>!pfIsSvc(P(l.code)));
 if(!ls.length)return null;
 return _dlIns13(docId,date,note,ls)};
const _rd13=recDraw;
recDraw=function(){
 _rd13();
 if(RT==='sale'||RT==='purchase')document.querySelectorAll('#r_tbl td span.mu').forEach(s=>{if(s.textContent.trim()==='0 / 0')s.textContent='no stock items'})};

/* transfers and stock in / out do not offer non-stock items */
const _docForm13=docForm;
docForm=function(type,id){
 if(type!=='transfer')return _docForm13(type,id);
 return withStockOnly(()=>_docForm13(type,id))};
const _docAdd13=docAdd;
docAdd=function(){
 const p=pByCode($('#e_code').value);
 if(p&&pfIsSvc(p)&&CUR.doc_type==='transfer')return toast('Non-stock items cannot be transferred.');
 _docAdd13()};
const _docPick13=docPick;
docPick=function(){
 _docPick13();
 const p=pByCode($('#e_code').value),av=$('#e_av');
 if(p&&av&&pfIsSvc(p))av.textContent='(non-stock item)'};
const _vadj13=V.adj;
V.adj=()=>withStockOnly(_vadj13);
const _adjAdd13=adjAdd;
adjAdd=function(){
 const p=pByCode($('#ad_c').value);
 if(p&&pfIsSvc(p))return toast('Non-stock items cannot be used in Stock In / Out.');
 _adjAdd13()};

/* Product Master: the Type field */
const nsUsed=code=>S.docs.some(d=>d.lines.some(l=>l.code===code));
PFX.push({
 html:r=>{
  if(S.nsOff)return'';
  const used=!!r.id&&nsUsed(r.code),t=r.item_type==='nonstock'?'nonstock':'stock';
  return`<div class="field"><label>Type</label><select class="input" id="pf_type" ${used?'disabled':''}><option value="stock" ${t==='stock'?'selected':''}>Stock item (quantity is tracked)</option><option value="nonstock" ${t==='nonstock'?'selected':''}>Non-stock item (service, delivery fee, made to order)</option></select>
  <p class="mu" style="margin-top:4px">${used?'This product is already used in invoices, so its type cannot be changed. ':''}For a non-stock item, "Purchase price" is the cost per unit used to work out profit.</p></div>`},
 read:o=>{const el=$('#pf_type');if(el&&!el.disabled)o.item_type=el.value;return null}});
pfRows=function(){
 const q=PF.q.trim().toLowerCase();
 return S.products.filter(p=>(!q||((p.code||'')+' '+(p.description||'')+' '+pfCatName(p.category_id)+' '+(pfIsSvc(p)?'non-stock service':'')).toLowerCase().includes(q))&&(!PF.cat||catMatch(p,PF.cat))).sort(byCode)};

/* Excel */
(function(){
 const f=SH['Products'];
 SH['Products']=()=>{const r=f();return r.map((x,i)=>i===0?[...x,'Type']:[...x,pfIsSvc(P(x[0]))?'Non-stock':'Stock'])};
 const g=SH['Stock Balance'];
 SH['Stock Balance']=()=>withStockOnly(g)})();

/* Restore puts the non-stock type back after the invoices are restored */
const _rs13=rsRun;
rsRun=async function(){
 const snap=RB;await _rs13();
 if(!snap||RB!==null||S.nsOff)return;
 const codes=snap.prod.filter(p=>p.item_type==='nonstock').map(p=>p.code);
 if(!codes.length)return;
 try{
  const {error}=await sb.rpc('restore_item_types',{p_tenant:T,p_codes:codes});
  if(error)throw error;
  await load();toast('Non-stock items restored')
 }catch(e){toast('Documents restored, but the non-stock type could not be restored: '+dErr(e))}};
