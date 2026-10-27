'use strict';
/* Stage 5: Expenses and Profit & Loss */
const XCATS=['Rent','Salary','Electricity','Water','Internet / Phone','Vehicle / Fuel','Transport','Marketing','Repairs','Tax / Fees','Other'];
const XPM=['Cash','Bank transfer','KBZPay','Wave Pay','AYA Pay','Other'];
let XF={f:'',t:'',c:'',l:''},XBUSY=false;
S.xcats=[];

/* categories are read together with the rest of the shop data */
const _load5=load;
load=async function(){
 const ok=await _load5();if(!ok)return false;
 const r=await sb.from('expense_categories').select('*').eq('tenant_id',T).order('name');
 S.xcats=r.error?[]:r.data;return true};

const xcAll=()=>[...XCATS.filter(c=>c!=='Other'),...S.xcats.map(c=>c.name).filter(n=>!XCATS.includes(n)),'Other'];
const xCan=()=>!readOnly()&&can('expenses');
const xRows=()=>{const A=ALW();
 return S.expenses.filter(e=>(!A||(e.location_id&&A.has(e.location_id)))&&(!XF.f||e.expense_date>=XF.f)&&(!XF.t||e.expense_date<=XF.t)
  &&(!XF.c||(e.category||'Other')===XF.c)&&(!XF.l||(XF.l==='_none'?!e.location_id:e.location_id===XF.l)))
  .sort((a,b)=>b.expense_date.localeCompare(a.expense_date))};

/* ---------- Expenses ---------- */
function xpDraw(){
 const rows=xRows(),by={},tot=rows.reduce((a,e)=>a+ +e.amount,0),W=xCan();
 rows.forEach(e=>{const k=e.category||'Other';by[k]=(by[k]||0)+ +e.amount});
 const mx=Math.max(1,...Object.values(by));
 $('#xp_sum').textContent=rows.length+' expenses · '+fmt(tot)+' Ks';
 $('#xp_by').innerHTML=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(k)}</span><b>${fmt(v)}</b></div><div style="height:6px;background:#e8f0fe;border-radius:4px"><div style="height:6px;width:${v/mx*100}%;background:var(--pr);border-radius:4px"></div></div></div>`).join('')||'<div class="empty">No expenses.</div>';
 $('#xp_b').innerHTML=rows.slice(0,300).map(e=>`<tr><td>${e.expense_date}</td><td>${esc(e.category||'Other')}</td><td style="white-space:normal">${esc(e.description)}</td><td>${e.location_id?esc(ln(e.location_id)):'<span class="mu">General</span>'}</td><td>${esc(e.method||'')}</td><td class="num">${fmt(e.amount)}</td><td class="act">${W?`<button class="btn sm" onclick="xpForm('${e.id}')">Edit</button><button class="btn sm d" onclick="xpDel('${e.id}')">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No expenses found.</td></tr>'
  +(rows.length>300?`<tr><td colspan="7" class="empty">Showing the first 300 of ${rows.length}. Use the filter to narrow down.</td></tr>`:'')}
V.expenses=()=>{
 XF={f:'',t:'',c:'',l:''};const A=ALW(),locs=vLocs();
 return['Expenses',`<div class="page-head"><b id="xp_sum"></b><div style="display:flex;gap:10px;flex-wrap:wrap">${can('master')&&!readOnly()?'<button class="btn" onclick="xcMgr()">Categories</button>':''}${xCan()?'<button class="btn primary" onclick="xpForm()">+ Add expense</button>':''}</div></div>
 <details class="card"><summary style="padding:13px 18px;cursor:pointer;font-weight:600">Filter</summary><div class="card-b hg">
  <div class="field"><label>From</label><input class="input" type="date" onchange="XF.f=this.value;xpDraw()"></div>
  <div class="field"><label>To</label><input class="input" type="date" onchange="XF.t=this.value;xpDraw()"></div>
  <div class="field"><label>Category</label><select class="input" onchange="XF.c=this.value;xpDraw()"><option value="">All</option>${xcAll().map(c=>`<option>${esc(c)}</option>`).join('')}</select></div>
  <div class="field"><label>Location</label><select class="input" onchange="XF.l=this.value;xpDraw()"><option value="">All</option>${A?'':'<option value="_none">General only</option>'}${locs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div></div></details>
 <div class="card"><div class="card-h">By category</div><div class="card-b" id="xp_by"></div></div>
 <div class="card"><div class="tw"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Location</th><th>Paid by</th><th class="num">Amount</th><th></th></tr></thead><tbody id="xp_b"></tbody></table></div></div>`,xpDraw]};
function xpForm(id){
 if(!xCan())return toast('You do not have permission to add expenses.');
 const e=id?S.expenses.find(x=>x.id===id):{expense_date:today(),category:'',description:'',location_id:'',method:'Cash',amount:''};
 if(!e)return;
 const A=ALW(),locs=vLocs(),opt=(a,v)=>a.map(x=>`<option ${x===v?'selected':''}>${esc(x)}</option>`).join('');
 openModal(`<div class="mbox"><h3>${id?'Edit':'Add'} expense</h3>
 <div class="field"><label>Date</label><input class="input" id="xp_d" type="date" value="${e.expense_date}"></div>
 <div class="field"><label>Category</label><select class="input" id="xp_c">${opt(xcAll(),e.category||'Other')}</select></div>
 <div class="field"><label>Description</label><input class="input" id="xp_n" value="${esc(e.description)}"></div>
 <div class="field"><label>Location</label><select class="input" id="xp_l">${A?'':'<option value="">General (all shops)</option>'}${locs.map(l=>`<option value="${l.id}" ${l.id===e.location_id?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div>
 <div class="field"><label>Paid by</label><select class="input" id="xp_m">${opt(XPM,e.method||'Cash')}</select></div>
 <div class="field"><label>Amount</label><input class="input" id="xp_a" type="number" min="0" step="any" inputmode="decimal" value="${e.amount}"></div>
 <div class="mact"><button class="btn" onclick="mclose()">Cancel</button><button class="btn primary" onclick="xpSave('${id||''}')">Save</button></div></div>`)}
async function xpSave(id){
 if(XBUSY)return;
 const row={expense_date:$('#xp_d').value,category:$('#xp_c').value,description:$('#xp_n').value.trim(),location_id:$('#xp_l').value||null,method:$('#xp_m').value,amount:R2($('#xp_a').value)};
 if(!row.expense_date)return toast('Choose a date');
 if(!(row.amount>0))return toast('Enter an amount');
 if(!row.description)row.description=row.category;
 if(ALW()&&!row.location_id)return toast('Choose a location');
 XBUSY=true;
 try{
  const q=id?sb.from('expenses').update(row).eq('id',id):sb.from('expenses').insert({...row,tenant_id:T}),
   {data,error}=await q.select();
  if(error)throw error;
  if(!data.length)throw new Error('You do not have permission to do this.');
  S.expenses=id?S.expenses.map(x=>x.id===id?data[0]:x):[...S.expenses,data[0]];
  mclose();toast('Saved');go('expenses')
 }catch(e){toast(dErr(e))}finally{XBUSY=false}}
async function xpDel(id){
 if(!xCan()||!confirm('Delete this expense?'))return;
 const {data,error}=await sb.from('expenses').delete().eq('id',id).select('id');
 if(error)return toast(dErr(error));
 if(!data.length)return toast('You do not have permission to delete this.');
 S.expenses=S.expenses.filter(x=>x.id!==id);toast('Deleted');go('expenses')}
function xcMgr(){
 openModal(`<div class="mbox"><h3>Expense categories</h3><p class="mu" style="margin-bottom:10px">Standard: ${esc(XCATS.join(', '))}. Add your own below.</p>
 ${S.xcats.map(c=>`<div class="row"><span>${esc(c.name)}</span><button class="btn sm d" onclick="xcDel('${c.id}')">Delete</button></div>`).join('')||'<p class="mu">No custom categories yet.</p>'}
 <div class="field" style="margin-top:12px"><label>New category</label><input class="input" id="xc_n"></div>
 <div class="mact"><button class="btn" onclick="mclose();go('expenses')">Close</button><button class="btn primary" onclick="xcAdd()">Add</button></div></div>`)}
async function xcAdd(){
 const n=$('#xc_n').value.trim();if(!n)return toast('Enter a name');
 if(xcAll().some(c=>c.toLowerCase()===n.toLowerCase()))return toast('This category already exists.');
 const {data,error}=await sb.from('expense_categories').insert({tenant_id:T,name:n}).select();
 if(error)return toast(dErr(error));
 if(!data.length)return toast('You do not have permission to do this.');
 S.xcats.push(data[0]);toast('Added');xcMgr()}
async function xcDel(id){
 if(!confirm('Delete this category? Old expenses keep their category name.'))return;
 const {data,error}=await sb.from('expense_categories').delete().eq('id',id).select('id');
 if(error)return toast(dErr(error));
 if(!data.length)return toast('You do not have permission to do this.');
 S.xcats=S.xcats.filter(c=>c.id!==id);xcMgr()}

/* ---------- Profit & Loss ---------- */
const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const GAIN=['Found / returned','Count correction'];
let PLS={f:'',t:''};
const cst=l=>+l.cost||+(P(l.code).purchase_price)||0;
const dAdd=(s,n)=>new Date(Date.parse(s+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const mStart=(y,m)=>y+'-'+String(m).padStart(2,'0')+'-01';
const mEnd=(y,m)=>y+'-'+String(m).padStart(2,'0')+'-'+String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0');
function plMonths(endYm,n){
 const [y0,m0]=endYm.split('-').map(Number),out=[];
 for(let i=n-1;i>=0;i--){let m=m0-i,y=y0;while(m<1){m+=12;y--}
  out.push({y,m,f:mStart(y,m),t:mEnd(y,m),lab:MN[m-1],yr:(m===1||i===n-1)?String(y):''})}
 return out}

/* every figure for one period and one location (or all locations) */
function plCalc(f,t,loc){
 const L=loc===undefined?LF:loc,A=ALW(),inR=d=>(!f||d>=f)&&(!t||d<=t),
  docs=S.docs.filter(d=>inR(d.doc_date)&&(!L||d.location_id===L)),
  ex=S.expenses.filter(e=>inR(e.expense_date)&&(!L||e.location_id===L)&&(!A||(e.location_id&&A.has(e.location_id)))),
  by=k=>docs.filter(d=>d.doc_type===k),
  val=a=>a.reduce((x,d)=>x+d.lines.reduce((y,l)=>y+l.qty*cst(l),0),0);
 const sales=sum(by('sale')),sret=sum(by('sret')),net=sales-sret,cogs=val(by('sale'))-val(by('sret')),
  outs=by('sout'),own=val(outs.filter(d=>d.reason==='Own use')),loss=val(outs.filter(d=>d.reason!=='Own use')),
  gain=val(by('sin').filter(d=>GAIN.includes(d.reason))),cats={};
 ex.forEach(e=>{const k=e.category||'Other';cats[k]=(cats[k]||0)+ +e.amount});
 const exp=Object.values(cats).reduce((a,b)=>a+b,0),gp=net-cogs;
 return{sales,sret,net,cogs,gp,cats,exp,loss,own,gain,profit:gp-exp-loss-own+gain}}
function plTop(f,t){
 const m={};
 S.docs.filter(d=>(d.doc_type==='sale'||d.doc_type==='sret')&&d.doc_date>=f&&d.doc_date<=t&&(!LF||d.location_id===LF)).forEach(d=>{
  const sg=d.doc_type==='sale'?1:-1;
  d.lines.forEach(l=>{const o=m[l.code]=m[l.code]||{code:l.code,desc:l.desc,qty:0,rev:0,cost:0};o.qty+=sg*l.qty;o.rev+=sg*l.qty*l.price;o.cost+=sg*l.qty*cst(l)})});
 return Object.values(m).map(o=>({...o,profit:o.rev-o.cost})).filter(o=>o.qty!==0||o.rev!==0).sort((a,b)=>b.profit-a.profit).slice(0,8)}
function plRange(){
 PLS.t=PLS.t||today();PLS.f=PLS.f||PLS.t.slice(0,8)+'01';
 if(PLS.f>PLS.t)[PLS.f,PLS.t]=[PLS.t,PLS.f];
 return PLS}
function plPreset(k){
 const t=today(),y=+t.slice(0,4),m=+t.slice(5,7);
 if(k==='m')PLS={f:mStart(y,m),t};
 else if(k==='lm'){let mm=m-1,yy=y;if(mm<1){mm=12;yy--}PLS={f:mStart(yy,mm),t:mEnd(yy,mm)}}
 else if(k==='y')PLS={f:y+'-01-01',t};
 else PLS={f:plMonths(t.slice(0,7),12)[0].f,t};
 go('pl')}
function plData(){
 const {f,t}=plRange(),days=Math.round((Date.parse(t+'T00:00:00Z')-Date.parse(f+'T00:00:00Z'))/864e5)+1,
  pt=dAdd(f,-1),pf=dAdd(pt,-(days-1)),multi=!LF&&vLocs().length>1;
 return{f,t,cur:plCalc(f,t),prev:plCalc(pf,pt),
  ms:plMonths(t.slice(0,7),12).map(m=>{const c=plCalc(m.f,m.t);return{...m,net:c.net,profit:c.profit}}),
  tops:plTop(f,t),
  locs:multi?vLocs().map(l=>({name:l.name,...plCalc(f,t,l.id)})):null,
  gen:multi&&!ALW()?S.expenses.filter(e=>!e.location_id&&e.expense_date>=f&&e.expense_date<=t).reduce((a,e)=>a+ +e.amount,0):0,
  locName:LF?ln(LF):(ALW()?'All my locations':'All locations')}}

/* chart: bars = net sales, line = net profit (drawn here, no outside library) */
function trendSvg(ms){
 const W=680,H=230,pl=50,pr=10,pt=14,pb=40,iw=W-pl-pr,ih=H-pt-pb,
  vals=ms.flatMap(m=>[m.net,m.profit,0]),mx=Math.max(...vals),mn=Math.min(...vals),rng=(mx-mn)||1,
  y=v=>pt+ih-(v-mn)/rng*ih,bw=iw/ms.length,y0=y(0),
  k=v=>{const a=Math.abs(v);return(v<0?'-':'')+(a>=1e6?(a/1e6).toFixed(a>=1e7?0:1)+'M':a>=1e3?Math.round(a/1e3)+'k':Math.round(a))};
 let g='';
 for(let i=0;i<=4;i++){const v=mn+rng*i/4,yy=y(v);g+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" stroke="#e3e8ef"/><text x="${pl-6}" y="${yy+4}" text-anchor="end" font-size="11" fill="#667085">${k(v)}</text>`}
 const bars=ms.map((m,i)=>`<rect x="${pl+i*bw+bw*.2}" y="${Math.min(y(m.net),y0)}" width="${bw*.6}" height="${Math.max(Math.abs(y(m.net)-y0),1)}" rx="3" fill="#c7d8fa"/>`).join(''),
  pts=ms.map((m,i)=>[pl+i*bw+bw/2,y(m.profit)]),
  line=`<polyline fill="none" stroke="#0f9d58" stroke-width="2.5" points="${pts.map(p=>p.join(',')).join(' ')}"/>`+pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#0f9d58"/>`).join(''),
  lab=ms.map((m,i)=>`<text x="${pl+i*bw+bw/2}" y="${H-pb+16}" text-anchor="middle" font-size="11" fill="#667085">${m.lab}</text>`+(m.yr?`<text x="${pl+i*bw+bw/2}" y="${H-pb+30}" text-anchor="middle" font-size="10" fill="#98a2b3">${m.yr}</text>`:'')).join('');
 return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Net sales and net profit by month">${g}<line x1="${pl}" x2="${W-pr}" y1="${y0}" y2="${y0}" stroke="#98a2b3"/>${bars}${line}${lab}</svg>`}

const dlt=(c,p)=>{
 if(!p)return c?'<span class="mu">no earlier data</span>':'';
 const v=(c-p)/Math.abs(p)*100,up=v>=0;
 return`<span style="font-size:12px;font-weight:600;color:${up?'#0f9d58':'#d92d20'}">${up?'▲':'▼'} ${Math.abs(v).toFixed(1)}%</span> <span class="mu">vs previous period</span>`};
const plCats=c=>Object.entries(c.cats).sort((a,b)=>b[1]-a[1]);
function plStmt(c){
 const rows=[['Sales',c.sales],['Less: sale returns',-c.sret],['Net sales',c.net,'sub'],['Cost of goods sold',-c.cogs],
  ['Gross profit'+(c.net?' ('+(c.gp/c.net*100).toFixed(1)+'%)':''),c.gp,'sub'],['Expenses','','head']];
 plCats(c).forEach(([k,v])=>rows.push([k,-v,'ind']));
 rows.push(['Total expenses',-c.exp,'sub'],['Stock loss (damaged, expired, lost, count correction)',-c.loss],
  ['Stock gains (found / returned, count correction)',c.gain],['Own use (goods taken by the owner)',-c.own],['Net profit',c.profit,'total']);
 return rows}
const plStmtHtml=rows=>`<table><tbody>${rows.map(([l,v,k])=>{
 const st=k==='sub'?'font-weight:700;background:#f8fafc':k==='total'?'font-weight:700;font-size:15px;background:#eef4ff':k==='head'?'font-weight:600;color:#667085':'';
 return`<tr style="${st}"><td style="white-space:normal;${k==='ind'?'padding-left:34px':''}">${esc(l)}</td><td class="num" style="${k==='total'?'color:'+(v>=0?'#0f9d58':'#d92d20'):''}">${v===''?'':fmt(v)}</td></tr>`}).join('')}</tbody></table>`;
const plTopHtml=t=>`<table><thead><tr><th>Code</th><th>Description</th><th class="num">Qty</th><th class="num">Sales</th><th class="num">Profit</th></tr></thead><tbody>${t.map(o=>`<tr><td>${esc(o.code)}</td><td style="white-space:normal">${esc(o.desc)}</td><td class="num">${fmt(o.qty)}</td><td class="num">${fmt(o.rev)}</td><td class="num">${fmt(o.profit)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No sales in this period.</td></tr>'}</tbody></table>`;
const plLocHtml=d=>`<table><thead><tr><th>Location</th><th class="num">Net sales</th><th class="num">Gross profit</th><th class="num">Margin</th><th class="num">Expenses</th><th class="num">Stock loss + own use</th><th class="num">Net profit</th></tr></thead><tbody>${d.locs.map(l=>`<tr><td>${esc(l.name)}</td><td class="num">${fmt(l.net)}</td><td class="num">${fmt(l.gp)}</td><td class="num">${l.net?(l.gp/l.net*100).toFixed(1)+'%':'-'}</td><td class="num">${fmt(l.exp)}</td><td class="num">${fmt(l.loss+l.own-l.gain)}</td><td class="num"><b>${fmt(l.profit)}</b></td></tr>`).join('')}
 ${d.gen?`<tr><td>General expenses (not assigned to a location)</td><td></td><td></td><td></td><td class="num">${fmt(d.gen)}</td><td></td><td class="num"><b>${fmt(-d.gen)}</b></td></tr>`:''}
 <tr style="font-weight:700;background:#eef4ff"><td>Total</td><td class="num">${fmt(d.cur.net)}</td><td class="num">${fmt(d.cur.gp)}</td><td class="num">${d.cur.net?(d.cur.gp/d.cur.net*100).toFixed(1)+'%':'-'}</td><td class="num">${fmt(d.cur.exp)}</td><td class="num">${fmt(d.cur.loss+d.cur.own-d.cur.gain)}</td><td class="num">${fmt(d.cur.profit)}</td></tr></tbody></table>`;
const PL_NOTE='Accrual basis: sales and purchases count on the invoice date, even if the customer has not paid yet. Cost of goods sold is the purchase cost of the goods actually sold (not the goods bought). Opening stock and Stock In "Other" are not counted.';

V.pl=()=>{
 const d=plData(),c=d.cur,p=d.prev,mg=c.net?(c.gp/c.net*100).toFixed(1):'0.0',
  kpi=(l,v,dd2,col)=>`<div class="card kpi"><div class="mu">${l}</div><div class="val" style="${col?'color:'+col:''}">${fmt(v)} Ks</div><div>${dd2}</div></div>`,
  cats=plCats(c),mxc=Math.max(1,...cats.map(x=>x[1])),
  btn=(k,t)=>`<button class="btn sm" onclick="plPreset('${k}')">${t}</button>`;
 return['Profit & Loss',`<div class="page-head"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${btn('m','This month')}${btn('lm','Last month')}${btn('y','This year')}${btn('12','Last 12 months')}
  <input class="input" style="width:auto" type="date" value="${d.f}" onchange="PLS.f=this.value;go('pl')"><input class="input" style="width:auto" type="date" value="${d.t}" onchange="PLS.t=this.value;go('pl')"></div>
  <div style="display:flex;gap:12px;align-items:center">${locSelHtml()}<button class="btn primary" onclick="plPrint()">Download PDF</button></div></div>
 <p class="mu" style="margin:-4px 0 14px">${esc(d.locName)} · ${d.f} to ${d.t}</p>
 <div class="grid">${kpi('Net sales',c.net,dlt(c.net,p.net))}${kpi('Gross profit',c.gp,'<span class="mu">Margin '+mg+'%</span> '+dlt(c.gp,p.gp))}${kpi('Expenses + stock adjustments',c.exp+c.loss+c.own-c.gain,'<span class="mu">Operating expenses, stock loss, own use</span>')}${kpi('Net profit',c.profit,dlt(c.profit,p.profit),c.profit>=0?'#0f9d58':'#d92d20')}</div>
 <div class="card"><div class="card-h" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>Net sales and net profit, 12 months to ${MN[+d.t.slice(5,7)-1]} ${d.t.slice(0,4)}</span><span class="mu"><span style="display:inline-block;width:10px;height:10px;background:#c7d8fa;border-radius:2px"></span> Net sales &nbsp; <span style="display:inline-block;width:10px;height:3px;background:#0f9d58;vertical-align:middle"></span> Net profit</span></div><div class="card-b">${trendSvg(d.ms)}</div></div>
 <div class="hg" style="margin-bottom:14px;align-items:start"><div class="card" style="margin:0"><div class="card-h">Profit and loss statement</div><div class="tw">${plStmtHtml(plStmt(c))}</div></div>
 <div class="card" style="margin:0"><div class="card-h">Expenses by category</div><div class="card-b">${cats.map(([k,v])=>`<div style="margin:8px 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(k)}</span><b>${fmt(v)} <span class="mu">(${c.exp?(v/c.exp*100).toFixed(0):0}%)</span></b></div><div style="height:6px;background:#e8f0fe;border-radius:4px"><div style="height:6px;width:${v/mxc*100}%;background:var(--pr);border-radius:4px"></div></div></div>`).join('')||'<div class="empty">No expenses in this period.</div>'}</div></div></div>
 <div class="card"><div class="card-h">Top products by profit</div><div class="tw">${plTopHtml(d.tops)}</div></div>
 ${d.locs?`<div class="card"><div class="card-h">Locations compared</div><div class="tw">${plLocHtml(d)}</div></div>`:''}
 <p class="mu" style="margin-bottom:6px">${esc(PL_NOTE)}</p>
 <p class="mu">Download PDF opens the print window. Choose Save as PDF (on a phone it is usually under Share).</p>`,()=>{RDRAW=()=>go('pl')}]};
function plPrint(){
 const d=plData(),c=d.cur;
 $('#print').innerHTML=`<h2>${esc(me().name||'')}</h2><h3>Profit and Loss Statement</h3><p>${d.f} to ${d.t} &nbsp; | &nbsp; ${esc(d.locName)} &nbsp; | &nbsp; Printed ${today()}</p>
 ${trendSvg(d.ms)}<h4>Statement</h4>${plStmtHtml(plStmt(c))}
 <h4>Top products by profit</h4>${plTopHtml(d.tops)}${d.locs?'<h4>Locations compared</h4>'+plLocHtml(d):''}
 <p style="font-size:11px;margin-top:10px">${esc(PL_NOTE)}</p>`;
 window.print()}

addNav('Accounts','expenses','Expenses','expenses');
addNav('Accounts','pl','Profit & Loss','reports');
