'use strict';
/* Stage 7: print settings, voucher themes and paper sizes */
const PV_DEF={theme:'classic',paper:'a4',paperSale:'',accent:'#1d5fd6',name:'',address:'',phone:'',email:'',taxno:'',logo:'',showLogo:true,titleSale:'',footer:'',bank:'',sign:true};
S.pset={};
const pvS=()=>({...PV_DEF,...(S.pset||{})});
const br=s=>esc(s).replace(/\r?\n/g,'<br>');
const pvIsThermal=p=>p==='80'||p==='58';
const pvNoThermal=p=>pvIsThermal(p)?'a4':(p||'a4');
const pvOkLogo=s=>/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(s||'');
const pvOkColor=s=>/^#[0-9a-f]{6}$/i.test(s||'');

/* the settings are read together with the shop data */
const _load7=load;
load=async function(){
 const ok=await _load7();if(!ok)return false;
 const r=await sb.from('shop_settings').select('data').eq('tenant_id',T).maybeSingle();
 S.pset=(!r.error&&r.data&&r.data.data)||{};return true};

/* ---------- styles (preview uses .pv, printing uses #print .pv) ---------- */
const pvCssFor=(p,print)=>`
${p}{font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Myanmar","Padauk",Roboto,sans-serif;color:#111;font-size:12px;line-height:1.5;background:#fff;text-align:left;overflow-wrap:anywhere;-webkit-print-color-adjust:exact;print-color-adjust:exact;${print?'max-width:100%;':''}}
${p}.p-a4{width:186mm}${p}.p-a5{width:128mm;font-size:11px}${p}.p-80{width:72mm;font-size:11px}${p}.p-58{width:50mm;font-size:10px}
${p} .v-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid #111}
${p} .v-hl{display:flex;gap:10px;align-items:flex-start;min-width:0}
${p} .v-lg{max-height:60px;max-width:140px;object-fit:contain}
${p} .v-nm{font-size:17px;font-weight:700}
${p} .v-in{font-size:11px;color:#444}
${p} .v-ttl{font-size:18px;font-weight:700;text-align:right}
${p} .v-meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 14px;margin-bottom:10px}
${p} .v-grid{display:grid;align-items:start}
${p} .v-c{padding:4px 6px;min-width:0}
${p} .v-r{text-align:right}
${p} .v-h{font-weight:700;background:#eee;border-top:1px solid #111;border-bottom:1px solid #111}
${p} .v-row{border-bottom:1px solid #bbb}
${p} .v-b{font-weight:700}
${p} .v-sub{font-weight:700;margin:10px 0 3px}
${p} .v-tt{margin:8px 0 0 auto;width:55%}
${p} .v-tl{display:flex;justify-content:space-between;gap:10px;padding:2px 6px}
${p} .v-tl.b{font-weight:700;border-top:1px solid #111;font-size:13px}
${p} .v-bk,${p} .v-nt{margin-top:10px;font-size:11px}
${p} .v-ft{margin-top:12px;font-size:11px;color:#333}
${p} .v-sig{display:flex;justify-content:space-between;margin-top:40px}
${p} .v-sig span{display:inline-block;border-top:1px solid #111;padding-top:3px;min-width:42mm;text-align:center}
${p}.t-modern .v-hd{border-bottom:3px solid var(--pvc,#1d5fd6)}
${p}.t-modern .v-ttl,${p}.t-modern .v-nm{color:var(--pvc,#1d5fd6)}
${p}.t-modern .v-h{background:var(--pvc,#1d5fd6);color:#fff;border:0;border-radius:4px}
${p}.t-modern .v-row{border-bottom:1px solid #e5e7eb}
${p}.t-modern .v-tl.b{border-top:2px solid var(--pvc,#1d5fd6);color:var(--pvc,#1d5fd6)}
${p}.t-compact{font-size:11px}
${p}.t-compact .v-nm,${p}.t-compact .v-ttl{font-size:14px}
${p}.t-compact .v-c{padding:2px 4px}
${p}.t-compact .v-hd{border-bottom:1px solid #111;padding-bottom:5px;margin-bottom:6px}
${p}.t-compact .v-h{background:none}
${p}.t-compact .v-row{border-bottom:1px solid #ddd}
${p}.t-detailed .v-meta{border:1px solid #111;padding:6px 8px}
${p}.t-detailed .v-tb{border:1px solid #111}
${p}.t-detailed .v-grid>.v-c{border-right:1px solid #ccc}
${p}.t-detailed .v-grid>.v-c:last-child{border-right:0}
${p}.rc .v-c0{text-align:center;margin-bottom:4px}
${p}.rc .v-nm{font-size:14px}
${p}.rc .v-in{color:#111}
${p}.rc .v-ttl{text-align:center;font-size:13px;margin-top:3px}
${p}.rc .v-lg{max-width:40mm;max-height:18mm}
${p}.rc .v-sep{border-top:1px dashed #111;margin:4px 0}
${p}.rc .v-li{margin:2px 0}
${p}.rc .v-lr{display:flex;justify-content:space-between;gap:8px}
${p}.rc .v-tl{padding:0}
${p}.rc .v-ft,${p}.rc .v-bk,${p}.rc .v-nt{text-align:center;color:#111}
`;
(function(){const s=document.createElement('style');s.id='pvcss';
 s.textContent=pvCssFor('.pv',false)+pvCssFor('#print .pv',true)+'@media print{#print{padding:0!important}}';
 document.head.appendChild(s)})();

/* ---------- print models: one for each kind of document ---------- */
function pvModelDoc(d,st){
 st=st||pvS();
 const c=DT[d.doc_type],isT=d.doc_type==='transfer',isP=!!c.pay,tot=dt(d),paid=d.paid||0,
  who=isT?{}:((S[c.p]||[]).find(x=>x.name===d.partner)||{}),
  ps=(d.payments||[]).slice().sort((a,b)=>(a.pay_date||'').localeCompare(b.pay_date||''));
 const cols=isT?[{h:'#',w:'26px'},{h:'Code',w:'90px'},{h:'Description',w:'1fr'},{h:'Qty',w:'60px',r:1}]
  :[{h:'#',w:'26px'},{h:'Code',w:'86px'},{h:'Description',w:'1fr'},{h:'Qty',w:'56px',r:1},{h:'Price',w:'74px',r:1},{h:'Amount',w:'84px',r:1}];
 const totals=isT?[]:isP?[['Total',fmt(tot)+' Ks'],['Paid',fmt(paid)+' Ks'],['Balance',fmt(tot-paid)+' Ks',1]]:[['Total',fmt(tot)+' Ks',1]];
 return{kind:d.doc_type,title:(d.doc_type==='sale'&&st.titleSale)||c.t,
  meta:[['No',d.doc_no||''],['Date',d.doc_date],...(isT?[['From',ln(d.location_id)],['To',ln(d.to_location_id)]]:[[c.pl,d.partner||'-'],['Location',ln(d.location_id)]])],
  more:isT?[]:[...(who.phone?[['Phone',who.phone]]:[]),...(who.address?[['Address',who.address]]:[])],
  cols,rows:d.lines.map((l,i)=>isT?[i+1,l.code,l.desc,fmt(l.qty)]:[i+1,l.code,l.desc,fmt(l.qty),fmt(l.price),fmt(l.qty*l.price)]),
  lines:d.lines.map(l=>({code:l.code,desc:l.desc,qty:l.qty,price:isT?null:l.price})),
  totals,pays:isP?ps:[],note:d.note||'',bank:d.doc_type==='sale',sig:['Prepared by',isT?'Received by':c.pl]}}
function pvModelAdj(d){
 return{kind:'adj',title:D[d.doc_type].t,
  meta:[['No',d.doc_no||''],['Date',d.doc_date],['Location',ln(d.location_id)],['Reason',d.reason||'-']],more:[],
  cols:[{h:'#',w:'26px'},{h:'Code',w:'90px'},{h:'Description',w:'1fr'},{h:'Qty',w:'60px',r:1}],
  rows:d.lines.map((l,i)=>[i+1,l.code,l.desc,fmt(l.qty)]),
  lines:d.lines.map(l=>({code:l.code,desc:l.desc,qty:l.qty,price:null})),
  totals:[],pays:[],note:d.note||'',bank:false,sig:['Prepared by','Approved by']}}
function pvModelStmt(){
 const {type,name,f,t}=CURP,v=stmtView(),isS=type==='sale',filt=!!(f||t),rows=[];
 if(filt)rows.push({cells:[f||'','Opening balance','','',fmt(v.open)],cls:'v-row v-b'});
 v.rows.forEach(r=>rows.push([r.date,r.txt,r.dr?fmt(r.dr):'',r.cr?fmt(r.cr):'',fmt(r.bal)]));
 return{kind:'stmt',title:'Statement of account',
  meta:[[isS?'Customer':'Supplier',name||'-'],['Period',filt?(f||'start')+' to '+(t||'today'):'All dates'],['Printed',today()]],more:[],
  cols:[{h:'Date',w:'84px'},{h:'Details',w:'1fr'},{h:isS?'Sold':'Bought',w:'80px',r:1},{h:'Paid / returned',w:'96px',r:1},{h:'Balance',w:'86px',r:1}],
  rows,totals:[['Balance'+(filt?' at end of period':''),fmt(v.close)+' Ks',1]],pays:[],note:'',bank:isS,sig:null}}

/* ---------- renderer ---------- */
function pvGrid(cols,rows){
 const tpl=cols.map(c=>c.w).join(' '),
  row=(cells,cls)=>`<div class="v-grid ${cls}" style="grid-template-columns:${tpl}">${cells.map((v,i)=>`<div class="v-c${cols[i]&&cols[i].r?' v-r':''}">${esc(v)}</div>`).join('')}</div>`;
 return`<div class="v-tb">${row(cols.map(c=>c.h),'v-h')}${rows.map(r=>Array.isArray(r)?row(r,'v-row'):row(r.cells,r.cls||'v-row')).join('')}</div>`}
function pvRender(m,st,paper){
 const th=['classic','modern','compact','detailed'].includes(st.theme)?st.theme:'classic',
  pp=['a4','a5','80','58'].includes(paper)?paper:'a4',thermal=pvIsThermal(pp)&&!!m.lines,
  acc=pvOkColor(st.accent)?st.accent:'#1d5fd6',
  logo=st.showLogo!==false&&pvOkLogo(st.logo)?st.logo:'',
  img=logo?`<img class="v-lg" src="${logo}" alt="">`:'',
  nm=esc(st.name||me().name||''),
  info=[st.address,st.phone&&'Tel: '+st.phone,st.email,st.taxno&&'Tax/Reg no: '+st.taxno].filter(Boolean).map(x=>`<div class="v-in">${br(x)}</div>`).join(''),
  foot=st.footer?`<div class="v-ft">${br(st.footer)}</div>`:'',
  note=m.note?`<div class="v-nt">Note: ${br(m.note)}</div>`:'',
  bank=m.bank&&st.bank?`<div class="v-bk"><b>Payment details</b><div>${br(st.bank)}</div></div>`:'',
  tots=(m.totals||[]).map(([a,b,bd])=>`<div class="v-tl${bd?' b':''}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join(''),
  cls=`pv t-${th} p-${pp}${thermal?' rc':''}`;
 let h;
 if(thermal){
  h=`<div class="v-c0">${img}<div class="v-nm">${nm}</div>${info}<div class="v-ttl">${esc(m.title)}</div></div><div class="v-sep"></div>
  ${m.meta.map(([a,b])=>`<div>${esc(a)}: ${esc(b)}</div>`).join('')}<div class="v-sep"></div>
  ${m.lines.map(l=>`<div class="v-li"><div>${esc(l.desc||l.code)}</div><div class="v-lr"><span>${fmt(l.qty)}${l.price!==null?' × '+fmt(l.price):''}</span>${l.price!==null?`<span>${fmt(l.qty*l.price)}</span>`:''}</div></div>`).join('')}
  <div class="v-sep"></div>${tots}${bank}${note}${foot}`}
 else{
  const meta=(th==='detailed'?m.meta.concat(m.more||[]):m.meta),
   pays=th==='detailed'&&m.pays&&m.pays.length?`<div class="v-sub">Payments</div>${pvGrid([{h:'Date',w:'100px'},{h:'Amount',w:'1fr',r:1},{h:'Method',w:'130px'}],m.pays.map(x=>[x.pay_date||'',fmt(x.amount),x.method||'']))}`:'',
   sig=st.sign!==false&&m.sig?`<div class="v-sig"><span>${esc(m.sig[0])}</span><span>${esc(m.sig[1])}</span></div>`:'';
  h=`<div class="v-hd"><div class="v-hl">${img}<div><div class="v-nm">${nm}</div>${info}</div></div><div class="v-ttl">${esc(m.title)}</div></div>
  <div class="v-meta">${meta.map(([a,b])=>`<div><b>${esc(a)}:</b> ${esc(b)}</div>`).join('')}</div>
  ${m.raw||pvGrid(m.cols,m.rows)}${tots?`<div class="v-tt">${tots}</div>`:''}${pays}${bank}${note}${foot}${sig}`}
 return`<div class="${cls}" style="--pvc:${acc}">${h}</div>`}

/* ---------- printing ---------- */
function pvPage(paper){
 let s=document.getElementById('pgstyle');
 if(!s){s=document.createElement('style');s.id='pgstyle';document.head.appendChild(s)}
 s.textContent={a4:'@page{size:A4;margin:12mm}',a5:'@page{size:A5;margin:10mm}','80':'@page{size:80mm auto;margin:3mm}','58':'@page{size:58mm auto;margin:2mm}'}[paper]||''}
function pvPrintModel(m,paper,st){
 st=st||pvS();$('#print').innerHTML=pvRender(m,st,paper);pvPage(paper);window.print()}
printDoc=function(d){
 const st=pvS();
 if(!DT[d.doc_type])return pvPrintModel(pvModelAdj(d),st.paper,st);
 pvPrintModel(pvModelDoc(d,st),(d.doc_type==='sale'&&st.paperSale)||st.paper,st)};
prtAdj=function(id){const d=S.docs.find(x=>x.id===id);if(d)pvPrintModel(pvModelAdj(d),pvS().paper)};
prtStmt=function(){pvPrintModel(pvModelStmt(),pvNoThermal(pvS().paper))};
plPrint=function(){
 const d=plData(),c=d.cur;
 pvPrintModel({kind:'pl',title:'Profit and Loss',meta:[['Period',d.f+' to '+d.t],['Location',d.locName],['Printed',today()]],more:[],
  raw:`${trendSvg(d.ms)}<div class="v-sub">Statement</div>${plStmtHtml(plStmt(c))}<div class="v-sub">Top products by profit</div>${plTopHtml(d.tops)}${d.locs?'<div class="v-sub">Locations compared</div>'+plLocHtml(d):''}<p style="font-size:10px;margin-top:8px">${esc(PL_NOTE)}</p>`,
  totals:[],pays:[],note:'',bank:false,sig:null},pvNoThermal(pvS().paper))};

/* ---------- Print settings page ---------- */
let PVD=null,PVB=false;
function pvSample(){
 const d=S.docs.filter(x=>x.doc_type==='sale').sort(sd).pop();
 if(d)return pvModelDoc(d,PVD);
 return pvModelDoc({doc_type:'sale',doc_no:'SI-S1-0001',doc_date:today(),partner:'Sample customer',location_id:(S.locations[0]||{}).id,note:'',paid:20000,
  payments:[{pay_date:today(),amount:20000,method:'Cash'}],lines:[{code:'P-001',desc:'Sample product A',qty:2,price:5000},{code:'P-002',desc:'Sample product B',qty:1,price:15000}]},PVD)}
function pvPrev(){
 const pg=$('#pv_pg'),box=$('#pv_box');if(!pg||!box||!PVD)return;
 pg.style.zoom=1;pg.style.width='auto';
 pg.innerHTML=pvRender(pvSample(),PVD,PVD.paperSale||PVD.paper);
 const el=pg.firstElementChild,w=el?el.getBoundingClientRect().width:0,av=box.clientWidth-40;
 if(w){pg.style.width=w+'px';pg.style.zoom=w>av&&av>0?av/w:1}}
function pvSet(k,v){PVD[k]=v;pvPrev()}
function pvRedraw(){const v=document.querySelector('#content .view');if(v){v.innerHTML=pvForm();pvPrev()}}
function pvForm(){
 const own=isOwner(),dis=own?'':'disabled',
  tx=(l,k,ph)=>`<div class="field"><label>${l}</label><input class="input" ${dis} placeholder="${esc(ph||'')}" value="${esc(PVD[k])}" oninput="pvSet('${k}',this.value)"></div>`,
  ta=(l,k,ph)=>`<div class="field"><label>${l}</label><textarea class="input" rows="2" ${dis} placeholder="${esc(ph||'')}" oninput="pvSet('${k}',this.value)">${esc(PVD[k])}</textarea></div>`,
  sel=(l,k,o)=>`<div class="field"><label>${l}</label><select class="input" ${dis} onchange="pvSet('${k}',this.value)">${o.map(([v,t])=>`<option value="${v}" ${PVD[k]===v?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`,
  ck=(l,k)=>`<label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:6px 0"><input type="checkbox" ${dis} ${PVD[k]!==false?'checked':''} onchange="pvSet('${k}',this.checked)"> ${l}</label>`,
  papers=[['a4','A4'],['a5','A5'],['80','Thermal 80 mm (receipt)'],['58','Thermal 58 mm (receipt)']];
 return`${own?'':'<div class="card"><div class="card-b mu">Only the shop owner can change these settings. You can still see how printouts look.</div></div>'}
 <div class="card"><div class="card-h">Shop details on printouts</div><div class="card-b hg">
  ${tx('Shop name','name',me().name||'')}${ta('Address','address')}${tx('Phone','phone')}${tx('Email','email')}${tx('Tax / registration no.','taxno')}
  <div class="field"><label>Logo</label>${pvOkLogo(PVD.logo)?`<div style="margin-bottom:8px"><img src="${PVD.logo}" alt="" style="max-height:60px;max-width:160px"></div>`:'<p class="mu" style="margin-bottom:6px">No logo yet.</p>'}
   <input class="input" type="file" accept="image/*" ${dis} onchange="pvLogo(this.files[0])">${PVD.logo&&own?'<button class="btn sm d" style="margin-top:6px" onclick="PVD.logo=\'\';pvRedraw()">Remove logo</button>':''}</div></div></div>
 <div class="card"><div class="card-h">Look and paper</div><div class="card-b hg">
  ${sel('Theme (A4 / A5)','theme',[['classic','Classic: black and white lines'],['modern','Modern: coloured header'],['compact','Compact: small, saves paper'],['detailed','Detailed: boxed, customer details and payments']])}
  ${sel('Default paper','paper',papers)}${sel('Paper for Sale Invoice','paperSale',[['','Same as default paper'],...papers])}
  <div class="field"><label>Accent colour (Modern theme)</label><input class="input" type="color" style="height:42px;padding:3px" ${dis} value="${pvOkColor(PVD.accent)?PVD.accent:'#1d5fd6'}" oninput="pvSet('accent',this.value)"></div>
  ${tx('Sale invoice title (optional)','titleSale','Sale Invoice')}${ta('Footer text','footer','Thank you for your business')}${ta('Payment details (shown on Sale Invoice and Statement)','bank','Bank, account name and number')}
  <div class="field"><label>&nbsp;</label>${ck('Show logo','showLogo')}${ck('Show signature lines (A4 / A5)','sign')}</div></div></div>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${own?'<button class="btn ok" onclick="pvSave()">Save</button>':''}<button class="btn" onclick="pvTest()">Print test page</button>${own?'<button class="btn" onclick="PVD={...PV_DEF};pvRedraw()">Reset to defaults</button>':''}</div>
 <div class="card"><div class="card-h">Preview <span class="mu">(a sale invoice; thermal paper uses the receipt layout)</span></div><div class="card-b" id="pv_box" style="background:#eef0f4;overflow:auto"><div id="pv_pg" style="background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15);margin:0 auto"></div></div></div>`}
V.pset=()=>{PVD={...pvS()};return['Print settings',pvForm(),pvPrev]};
addNav('Shops & Team','pset','Print settings');
function pvTest(){pvPrintModel(pvSample(),PVD.paperSale||PVD.paper,PVD)}
async function pvSave(){
 if(!isOwner())return toast('Only the shop owner can change print settings.');
 if(PVB)return;PVB=true;
 try{
  const data={...PVD},{error}=await sb.from('shop_settings').upsert({tenant_id:T,data,updated_at:new Date().toISOString()},{onConflict:'tenant_id'});
  if(error)throw error;
  S.pset=data;toast('Saved');
 }catch(e){
  const m=e.message||String(e);
  toast(/shop_settings/.test(m)&&/exist|schema cache/i.test(m)?'Please run the SQL for print settings first.':dErr(e))}
 finally{PVB=false}}
async function pvLogo(f){
 if(!f)return;
 try{
  const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)}),
   img=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=url});
  for(const max of [320,240,160]){
   const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
   const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);
   let out=c.toDataURL('image/png');
   if(out.length>90000){x.globalCompositeOperation='destination-over';x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);out=c.toDataURL('image/jpeg',.8)}
   if(out.length<=90000){PVD.logo=out;pvRedraw();return toast('Logo ready. Press Save to keep it.')}}
  toast('This image is too detailed. Please try a simpler logo.')
 }catch(e){toast('This image could not be read. Try a PNG or JPG file.')}}
