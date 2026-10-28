'use strict';
/* Stage 6c: Export to Excel */
const X={f:'',t:''};
function xlLoad(){
 return window.XLSX?Promise.resolve():new Promise((ok,no)=>{
  const u=['/lib/xlsx/0.18.5/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];let i=0;
  const t=()=>{if(i>=u.length)return no();const s=document.createElement('script');s.src=u[i++];s.onload=ok;s.onerror=()=>{s.remove();t()};document.head.appendChild(s)};t()})}
const xLoc=d=>!LF||d.location_id===LF||d.to_location_id===LF;
const xIn=d=>(!X.f||d.doc_date>=X.f)&&(!X.t||d.doc_date<=X.t);
const xD=(type,dated=true)=>S.docs.filter(d=>d.doc_type===type&&xLoc(d)&&(!dated||xIn(d))).sort(sd);
const xT=d=>dt(d),xP=d=>d.paid||0,xC=l=>cst(l);
const xSt=d=>{const b=xT(d)-xP(d);return b<=0.0001?'Paid':xP(d)>0?'Partial':'Unpaid'};
const xAge=d=>Math.max(0,Math.floor((Date.now()-new Date(d.doc_date))/864e5));
const xSum=t=>[['Doc No','Date',t==='sale'?'Customer':'Supplier','Location','Items','Total','Paid','Balance','Status'],...xD(t).map(d=>[d.doc_no,d.doc_date,d.partner,ln(d.location_id),d.lines.length,xT(d),xP(d),xT(d)-xP(d),xSt(d)])];
const xItems=t=>{const s=t==='sale';return[['Doc No','Date',s?'Customer':'Supplier','Location','Code','Description','Qty','Price','Amount',...(s?['Cost','Profit']:[])],...xD(t).flatMap(d=>d.lines.map(l=>[d.doc_no,d.doc_date,d.partner,ln(d.location_id),l.code,l.desc,l.qty,l.price,l.qty*l.price,...(s?[xC(l)*l.qty,l.qty*(l.price-xC(l))]:[])]))]};
const xOwe=t=>[['Doc No','Date',t==='sale'?'Customer':'Supplier','Location','Total','Paid','Balance','Days outstanding'],...xD(t,false).filter(d=>xT(d)-xP(d)>0.0001).map(d=>[d.doc_no,d.doc_date,d.partner,ln(d.location_id),xT(d),xP(d),xT(d)-xP(d),xAge(d)])];
const SH={
'Stock Balance':()=>{const s=stock(),L=sbLocs();return[['Code','Description','Unit',...L.map(l=>l.name),'Total','Purchase Price','Sale Price','Stock Value (cost)','Min Stock','Status'],
 ...S.products.slice().sort(byCode).map(p=>{const t=L.reduce((a,l)=>a+((s[p.code]||{})[l.id]||0),0);return[p.code,p.description,p.unit,...L.map(l=>(s[p.code]||{})[l.id]||0),t,p.purchase_price,p.sale_price,t*p.purchase_price,p.min_stock,t<=p.min_stock?'Low stock':'OK']})]},
'Sales Summary':()=>xSum('sale'),'Sales Items':()=>xItems('sale'),
'Purchase Summary':()=>xSum('purchase'),'Purchase Items':()=>xItems('purchase'),
'Returns':()=>[['Doc No','Type','Date','Partner','Location','Code','Description','Qty','Price','Amount'],...[...xD('sret'),...xD('pret')].flatMap(d=>d.lines.map(l=>[d.doc_no,D[d.doc_type].t,d.doc_date,d.partner,ln(d.location_id),l.code,l.desc,l.qty,l.price,l.qty*l.price]))],
'Transfers':()=>[['Doc No','Date','From','To','Code','Description','Qty','Note'],...xD('transfer').flatMap(d=>d.lines.map(l=>[d.doc_no,d.doc_date,ln(d.location_id),ln(d.to_location_id),l.code,l.desc,l.qty,d.note]))],
'Stock Adjustments':()=>[['Doc No','Date','Type','Location','Reason','Note','Code','Description','Qty','Cost per unit','Cost value'],...[...xD('sin'),...xD('sout')].sort(sd).flatMap(d=>d.lines.map(l=>[d.doc_no,d.doc_date,D[d.doc_type].t,ln(d.location_id),d.reason||'',d.note||'',l.code,l.desc,l.qty,l.cost||0,l.qty*(l.cost||0)]))],
'Unpaid Sales':()=>xOwe('sale'),'Unpaid Purchases':()=>xOwe('purchase'),
'Profit and Loss':()=>{
 const all=[...S.docs.map(d=>d.doc_date),...S.expenses.map(e=>e.expense_date)].filter(Boolean).sort(),
  f=X.f||all[0]||today(),t=X.t||today(),[y1,m1]=f.slice(0,7).split('-').map(Number),[y2,m2]=t.slice(0,7).split('-').map(Number),rows=[];
 let y=y1,m=m1;
 for(let n=0;n<60&&(y<y2||(y===y2&&m<=m2));n++){
  const a=mStart(y,m)<f?f:mStart(y,m),b=mEnd(y,m)>t?t:mEnd(y,m),c=plCalc(a,b);
  rows.push([y+'-'+String(m).padStart(2,'0'),c.net,c.cogs,c.gp,c.exp,c.loss,c.own,c.gain,c.profit]);m++;if(m>12){m=1;y++}}
 const tot=[...Array(8)].map((_,i)=>rows.reduce((s,r)=>s+r[i+1],0));
 return[['Month','Net sales','Cost of goods sold','Gross profit','Expenses','Stock loss','Own use','Stock gains','Net profit'],...rows,['TOTAL',...tot]]},
'Products':()=>[['Code','Description','Purchase Price','Sale Price','Unit','Min Stock'],...S.products.slice().sort(byCode).map(p=>[p.code,p.description,p.purchase_price,p.sale_price,p.unit,p.min_stock])],
'Customers':()=>[['Code','Name','Phone','Address'],...S.customers.map(r=>[r.code,r.name,r.phone,r.address])],
'Suppliers':()=>[['Code','Name','Phone','Address'],...S.suppliers.map(r=>[r.code,r.name,r.phone,r.address])],
'Expenses':()=>[['Date','Category','Description','Location','Paid by','Amount'],...xRows().filter(e=>(!X.f||e.expense_date>=X.f)&&(!X.t||e.expense_date<=X.t)).map(r=>[r.expense_date,r.category||'Other',r.description,r.location_id?ln(r.location_id):'General',r.method||'',r.amount])]};
const REP=[['Stock Balance','Stock by location, stock value, low-stock flag'],['Sales Summary','One row per sale invoice (paid / partial / unpaid)'],['Sales Items','Every item sold, with cost and profit'],['Purchase Summary','One row per purchase invoice'],['Purchase Items','Every item purchased'],['Returns','Sale and purchase returns'],['Transfers','Stock moved between locations'],['Stock Adjustments','Stock In / Stock Out with reason'],['Unpaid Sales','Customers who still owe you'],['Unpaid Purchases','What you still owe suppliers'],['Profit and Loss','Monthly sales, cost, gross and net profit'],['Products','Product master'],['Customers','Customer list'],['Suppliers','Supplier list'],['Expenses','Expense list']];

async function xlsx(names,file){
 try{await xlLoad()}catch(e){return toast('The Excel library could not load. Check your connection and try again.')}
 const wb=XLSX.utils.book_new();
 names.forEach(n=>{const r=SH[n](),ws=XLSX.utils.aoa_to_sheet(r);
  ws['!cols']=r[0].map((_,i)=>({wch:Math.min(40,Math.max(8,...r.slice(0,200).map(x=>String(x[i]??'').length))+2)}));
  XLSX.utils.book_append_sheet(wb,ws,n)});
 XLSX.writeFile(wb,file+'_'+today()+'.xlsx');toast('Excel downloaded')}
function xlAll(){xlsx(REP.map(r=>r[0]),'retailpro_all_reports')}
function xlOne(i){xlsx([REP[i][0]],REP[i][0].toLowerCase().replace(/ /g,'_'))}

V.export=()=>{
 X.f='';X.t='';RDRAW=()=>{};
 return['Export to Excel',`<div class="card"><div class="card-b"><p class="mu" style="margin-bottom:12px">Download your reports as Excel files. The date range applies to sales, purchases, returns, transfers, stock adjustments, expenses and profit. Stock balance and the unpaid lists always show the current position.</p>
 <div class="hg"><div class="field"><label>From</label><input class="input" type="date" onchange="X.f=this.value"></div><div class="field"><label>To</label><input class="input" type="date" onchange="X.t=this.value"></div><div class="field"><label>Location</label>${locSelHtml().replace(/<label[^>]*>Location /,'<label style="display:block">').replace('<select class="input" style="width:auto;padding:5px 8px"','<select class="input"')}</div>
 <div class="field"><label>&nbsp;</label><button class="btn primary" onclick="xlAll()">Download all reports</button></div></div></div></div>
 <div class="card"><div class="tw"><table><tbody>${REP.map(([n,t],i)=>`<tr><td><b>${n}</b><br><span class="mu">${t}</span></td><td class="act"><button class="btn sm" onclick="xlOne(${i})">Excel</button></td></tr>`).join('')}</tbody></table></div></div>`]};
addNav('Data','export','Export to Excel','reports');
