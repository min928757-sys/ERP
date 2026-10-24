'use strict';
const sb=supabase.createClient(location.origin+'/sb','sb_publishable_aLwnGUpyhaxJqBqmOIy6dw_3pG_Lkwg');
const $=s=>document.querySelector(s),fmt=n=>(+n||0).toLocaleString('en-US'),R2=n=>Math.round((+n||0)*100)/100,
 esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 today=()=>new Date().toISOString().slice(0,10);
const S={locations:[],products:[],customers:[],suppliers:[],expenses:[],docs:[]},V={},NEED={};
let T='',MY=[],RS=null,LF='',SUP=null;
const D={sale:{t:'Sale Invoice',s:-1},sret:{t:'Sale Return',s:1},purchase:{t:'Purchase Invoice',s:1},pret:{t:'Purchase Return',s:-1},transfer:{t:'Stock Transfer'},sin:{t:'Stock In',s:1},sout:{t:'Stock Out',s:-1}};
const NAV=['Dashboard','Sales','Purchase','Inventory','Accounts','Shops & Team','Data','Admin'].map(g=>({g,items:[]}));
const addNav=(g,id,t,need)=>{NAV.find(x=>x.g===g).items.push([id,t]);if(need)NEED[id]=need};

/* errors are shown on screen (no console on phones) */
function banner(m){let b=$('#dbg');if(!b){b=document.createElement('div');b.id='dbg';b.className='dbg';b.onclick=()=>b.remove();document.body.appendChild(b)}b.textContent=m}
addEventListener('error',e=>banner('JS error: '+e.message+' ('+String(e.filename||'').split('/').pop()+':'+e.lineno+')'));
addEventListener('unhandledrejection',e=>banner('Error: '+((e.reason&&e.reason.message)||e.reason)));
const toast=m=>{const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)};
const openModal=h=>{$('#modal').innerHTML=h;$('#modal').classList.add('show')},mclose=()=>$('#modal').classList.remove('show');

/* icons */
const IC={dash:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
 sales:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',buy:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
 box:'<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
 card:'<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 db:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
 tool:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>'};
const svg=k=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k]||''}</svg>`;
const GICON={Dashboard:'dash',Sales:'sales',Purchase:'buy',Inventory:'box',Accounts:'card','Shops & Team':'users',Data:'db',Admin:'tool'};
$('#logo').innerHTML=svg('box');

/* current shop, role, permissions, locations */
const me=()=>MY.find(m=>m.id===T)||{};
const can=k=>{const m=me();return m.role==='owner'||!m.perms||m.perms.includes(k)};
const ALW=()=>{const m=me();return(m.role==='owner'||!m.locs)?null:new Set(m.locs)};
const vLocs=()=>{const A=ALW();return S.locations.filter(l=>!A||A.has(l.id))};
const readOnly=()=>{const m=me();return m.role==='viewer'||(m.status&&m.status!=='active')};
const ln=id=>(S.locations.find(l=>l.id===id)||{}).name||'-',P=c=>S.products.find(p=>p.code===c)||{};
const dt=d=>d.lines.reduce((a,l)=>a+l.qty*(l.price||0),0),sum=a=>a.reduce((x,d)=>x+dt(d),0),dd=t=>S.docs.filter(d=>d.doc_type===t);

/* stock is calculated from all documents (+ other locations' totals for restricted staff) */
function stock(){const s={},a=(c,l,q)=>{(s[c]=s[c]||{})[l]=(s[c][l]||0)+q},A=ALW();
 S.docs.forEach(d=>d.lines.forEach(l=>{if(d.doc_type==='transfer'){a(l.code,d.location_id,-l.qty);a(l.code,d.to_location_id,l.qty)}else a(l.code,d.location_id,D[d.doc_type].s*l.qty)}));
 if(A&&RS){for(const c in s)for(const l in s[c])if(!A.has(l))delete s[c][l];RS.forEach(r=>{(s[r.r_code]=s[r.r_code]||{})[r.r_loc]=+r.r_qty})}
 return s}
const tq=c=>Object.values(stock()[c]||{}).reduce((a,b)=>a+b,0);
function neg(){const s=stock();for(const c in s)for(const l in s[c])if(s[c][l]<0)return c+' at '+ln(l)}

/* data: reads every page of 1000 rows, so there is no record limit */
async function pageAll(t,sel){const out=[];
 for(let f=0;;f+=1000){const r=await sb.from(t).select(sel||'*').eq('tenant_id',T).order('id',{ascending:true}).range(f,f+999);
  if(r.error)return{error:r.error};out.push(...r.data);if(r.data.length<1000)break}
 return{data:out}}
async function load(){
 const r=await Promise.all(['locations','products','customers','suppliers','expenses'].map(t=>pageAll(t)).concat(pageAll('documents','*,document_lines(*),payments(*)')));
 const bad=r.find(x=>x.error);if(bad){toast(bad.error.message);return false}
 [S.locations,S.products,S.customers,S.suppliers,S.expenses]=r.slice(0,5).map(x=>x.data);
 S.docs=r[5].data.map(d=>({...d,lines:d.document_lines.map(l=>({code:l.product_code,desc:l.description,qty:+l.qty,price:+l.price,cost:+l.cost})),payments:d.payments,paid:d.payments.reduce((a,p)=>a+ +p.amount,0)}));
 RS=null;const A=ALW();
 if(A){const x=await sb.rpc('location_stock',{p_tenant:T});if(x.error){toast(x.error.message);return false}RS=x.data.filter(r=>!A.has(r.r_loc))}
 if(LF&&!vLocs().some(l=>l.id===LF))LF='';
 return true}

/* pages and menu */
function buildNav(){
 $('#nav').innerHTML=NAV.map(g=>({g:g.g,items:g.items.filter(([id])=>!NEED[id]||can(NEED[id]))})).filter(g=>g.items.length).map(({g,items})=>
  items.length===1&&g==='Dashboard'?`<button class="gh si" data-id="${items[0][0]}">${svg(GICON[g])}<span>${g}</span></button>`:
  `<div class="grp"><button class="gh" data-g="1">${svg(GICON[g])}<span>${g}</span><i>›</i></button><div class="sub">${items.map(([id,t])=>`<button class="si" data-id="${id}">${t}</button>`).join('')}</div></div>`).join('')}
$('#nav').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.g)b.parentNode.classList.toggle('open');else if(b.dataset.id)go(b.dataset.id)});
function go(id,arg){const k=NEED[id];if(k&&!can(k)){toast('You do not have access to this page.');return}
 const v=V[id];if(!v){toast('This page is not added yet: '+id);return}
 document.querySelectorAll('.si').forEach(b=>{const on=b.dataset.id===id;b.classList.toggle('on',on);if(on&&b.closest('.grp'))b.closest('.grp').classList.add('open')});
 $('#sidebar').classList.remove('open');
 const [t,h,fn]=v(arg);$('#title').textContent=t;const c=$('#content');c.innerHTML='<div class="view">'+h+'</div>';c.scrollTop=0;if(fn)fn()}
$('#burger').onclick=()=>$('#sidebar').classList.toggle('open');

/* dashboard */
addNav('Dashboard','dash','Dashboard');
V.dash=()=>{const td=today(),k=(l,v)=>`<div class="card kpi"><div class="mu">${l}</div><div class="val">${fmt(v)} Ks</div></div>`;
 let val=0;const low=[];S.products.forEach(p=>{const q=tq(p.code);val+=q*p.purchase_price;if(q<=p.min_stock)low.push([p,q])});
 return['Dashboard',`<div class="grid">${k("Today's sales",sum(dd('sale').filter(x=>x.doc_date===td)))}${k('Total sales',sum(dd('sale')))}${k('Total purchases',sum(dd('purchase')))}${k('Stock value',val)}</div>
 <div class="card"><div class="card-h">Low stock (${low.length})</div><div class="card-b">${low.slice(0,12).map(([p,q])=>`<div class="row"><span>${esc(p.description)}</span><b>${fmt(q)} left</b></div>`).join('')||'<div class="empty">All items are well stocked</div>'}</div></div>`]};

/* shops and status banner */
function shopUI(){
 const m=me();document.body.classList.toggle('viewer',readOnly());
 $('#shop').innerHTML=MY.length>1?`<select class="input" style="padding:5px 8px;width:auto;max-width:200px" id="shopsel">${MY.map(x=>`<option value="${x.id}" ${x.id===T?'selected':''}>${esc(x.name)}${x.role==='owner'?'':' ('+x.role+')'}</option>`).join('')}</select>`:`<span class="mu">${esc(m.name||'')}</span>`;
 const s=$('#shopsel');if(s)s.onchange=()=>swShop(s.value);
 const b=$('#sbn'),st=m.status||'active';
 if(st==='pending'){b.style.cssText='background:#fff4dd;color:#8a5300';b.textContent='Your account is waiting for approval. You can look around, but you can add data only after it is approved.';b.classList.remove('hidden')}
 else if(st==='paused'){b.style.cssText='background:#fdecea;color:#b42318';b.textContent='This shop is paused. You can view and download your data but cannot add or change records. Please contact your service provider.';b.classList.remove('hidden')}
 else b.classList.add('hidden')}
async function loadShops(){
 const {data:pr}=await sb.from('profiles').select('tenant_id,role,perms,locs'),{data:ts}=await sb.from('tenants').select('id,name,status');
 MY=(pr||[]).map(p=>{const t=(ts||[]).find(x=>x.id===p.tenant_id)||{};return{id:p.tenant_id,role:p.role,perms:p.perms,locs:p.locs,name:t.name||'Shop',status:t.status||'active'}});
 return MY.length}
async function swShop(id){T=id;try{localStorage.setItem('shopT',id)}catch(e){}shopUI();if(await load()){buildNav();go('dash')}}

/* sign in / sign up / sign out */
let signup=0;const err=m=>$('#err').textContent=m;
function mode(m){signup=m;$('#snw').classList.toggle('hidden',!m);$('#go').textContent=m?'Create account':'Sign in';$('#t_in').className='btn'+(m?'':' primary');$('#t_up').className='btn'+(m?' primary':'')}
async function doAuth(){err('');const e=$('#em').value.trim(),p=$('#pw').value;if(!e||p.length<6)return err('Enter your email and a password of 6+ characters');
 if(signup){const sn=$('#sn').value.trim();if(!sn)return err('Enter your shop name');
  const {data,error}=await sb.auth.signUp({email:e,password:p,options:{data:{shop:sn}}});if(error)return err(error.message);
  if(!data.session)return err('Account created. Please confirm via the email we sent, then sign in.')}
 else{const {error}=await sb.auth.signInWithPassword({email:e,password:p});if(error)return err(error.message)}
 start()}
async function start(){
 const {data:{session}}=await sb.auth.getSession();if(!session)return;
 await sb.rpc('claim_invites');
 if(!await loadShops()){const {error}=await sb.rpc('create_shop',{shop_name:session.user.user_metadata.shop||'My Shop'});if(error)return err(error.message);await loadShops()}
 let sv=null;try{sv=localStorage.getItem('shopT')}catch(e){}
 T=(MY.find(m=>m.id===sv)||MY[0]).id;shopUI();
 if(!await load())return err('Could not load your data. Please try again.');
 $('#login').classList.add('hidden');$('#app').classList.remove('hidden');buildNav();go('dash')}
async function logout(){await sb.auth.signOut();location.reload()}
async function forgotPw(){const e=$('#em').value.trim();if(!e)return err('Enter your email above first');
 const {error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.origin+location.pathname});err(error?error.message:'If this email has an account, a reset link has been sent.')}
sb.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY')openModal('<div class="mbox"><h3>Set a new password</h3><div class="field"><label>New password (6+ characters)</label><input class="input" id="rp" type="password"></div><div class="mact"><button class="btn primary" id="rps">Save</button></div></div>')});
document.addEventListener('click',async e=>{if(e.target.id==='rps'){const p=$('#rp').value;if(p.length<6)return toast('Password needs 6+ characters');
 const {error}=await sb.auth.updateUser({password:p});if(error)return toast(error.message);mclose();toast('Password updated')}});
$('#t_in').onclick=()=>mode(0);$('#t_up').onclick=()=>mode(1);$('#go').onclick=doAuth;$('#lo').onclick=logout;
$('#fp').onclick=e=>{e.preventDefault();forgotPw()};$('#pw').addEventListener('keydown',e=>e.key==='Enter'&&doAuth());
start();
