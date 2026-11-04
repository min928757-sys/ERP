'use strict';
/* Stage 6d: user limit per shop (the database enforces it; this file shows it) */
const MAXU_DEFAULT=3;

/* read max_users together with the shops (falls back if the SQL has not been run yet) */
loadShops=async function(){
 const {data:pr}=await sb.from('profiles').select('tenant_id,role,perms,locs');
 let r=await sb.from('tenants').select('id,name,status,max_users');
 if(r.error)r=await sb.from('tenants').select('id,name,status');
 const ts=r.data||[];
 MY=(pr||[]).map(p=>{const t=ts.find(x=>x.id===p.tenant_id)||{};
  return{id:p.tenant_id,role:p.role,perms:p.perms,locs:p.locs,name:t.name||'Shop',status:t.status||'active',max_users:t.max_users==null?null:+t.max_users}});
 return MY.length};

const usersMax=()=>{const m=me();return m.max_users==null?null:+m.max_users};
const usersFull=()=>{const mx=usersMax();return mx!==null&&TEAM.length>=mx};

/* staff page: "Users 2 of 3" */
const _teamLoad6=teamLoad;
teamLoad=async function(){
 await _teamLoad6();
 const box=$('#team');if(!box||!box.querySelector('table'))return;
 const mx=usersMax();if(mx===null)return;
 const n=TEAM.length;
 box.insertAdjacentHTML('afterbegin',`<div style="padding:12px 18px;border-bottom:1px solid var(--ln)"><b>Users ${n} of ${mx}</b> <span class="mu">(the owner and invited people are counted)</span>${n>=mx?' <span class="badge bad">Limit reached</span>':''}</div>`)};
const _tmForm6=tmForm;
tmForm=function(i){
 if(i<0&&usersFull())return toast('User limit reached ('+TEAM.length+' of '+usersMax()+'). Please contact your service provider to add more.');
 _tmForm6(i)};

/* only the super admin can create another shop (every new shop also starts as "waiting for approval") */
const _vshops6=V.shops;
V.shops=a=>{
 const r=_vshops6(a);
 if(!SUP)r[1]=r[1].replace(/<div class="card"><div class="card-h">Add another shop<\/div>[\s\S]*?<\/div><\/div><\/div>/,'');
 return r};

/* Client Accounts: users used / limit, and a button to change the limit */
clDraw=function(){
 const q=($('#cl_q')?$('#cl_q').value:'').toLowerCase(),ord={pending:0,paused:1,active:2},
  rows=CL.filter(c=>(c.c_shop+' '+(c.c_owner||'')).toLowerCase().includes(q)).sort((a,b)=>(ord[a.c_status]??2)-(ord[b.c_status]??2)),
  np=CL.filter(c=>c.c_status==='pending').length;
 $('#cl_n').innerHTML=CL.length+' clients'+(np?' &middot; <span class="badge warn">'+np+' waiting for approval</span>':'');
 $('#cl').innerHTML=`<table><thead><tr><th>Client</th><th>Status</th><th>Owner email</th><th class="num">Users</th><th>Last login</th><th class="num">Invoices</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(c=>{
  const ll=c.c_last?new Date(c.c_last):null,d=ll?Math.floor((Date.now()-ll)/864e5):0,full=c.c_max!=null&&c.c_members>=c.c_max,
   act=c.c_status==='active'?`<button class="btn sm d" onclick="clSet('${c.c_tenant}','paused')">Pause</button>`:`<button class="btn sm ok" onclick="clSet('${c.c_tenant}','active')">${c.c_status==='pending'?'Approve':'Resume'}</button>`;
  return`<tr><td><b>${esc(c.c_shop)}</b><br><span class="mu">created ${c.c_created}</span></td><td>${stBadge(c.c_status)}</td><td>${esc(c.c_owner||'-')}</td><td class="num"><b>${c.c_members}</b> / ${c.c_max==null?'-':c.c_max}${full?' <span class="badge warn">full</span>':''}</td><td>${ll?ll.toISOString().slice(0,10)+(d>30?' <span class="badge warn">'+d+'d ago</span>':''):'<span class="mu">never</span>'}</td><td class="num">${fmt(c.c_docs)}</td><td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${esc(c.c_note||'')}">${esc(c.c_note||'')}</td><td class="act">${act}<button class="btn sm" onclick="clMax('${c.c_tenant}')">Limit</button><button class="btn sm" onclick="clNote('${c.c_tenant}')">Note</button><button class="btn sm" onclick="clAccess('${c.c_tenant}')">Access</button><button class="btn sm primary" onclick="clView('${c.c_tenant}')">View</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No clients found.</td></tr>'}</tbody></table>`};
async function clMax(id){
 const c=CL.find(x=>x.c_tenant===id);if(!c)return;
 const v=prompt('Max users for "'+c.c_shop+'" ('+c.c_members+' used now). Enter a number:',c.c_max==null?MAXU_DEFAULT:c.c_max);
 if(v===null)return;
 const n=Math.floor(+v);if(!(n>=1))return toast('Enter a number of 1 or more');
 const {error}=await sb.rpc('admin_set_max_users',{p_tenant:id,p_max:n});
 if(error)return toast(error.message);
 toast('Limit set to '+n);clLoad()}
