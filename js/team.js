'use strict';
/* Stage 6a: shops, staff permissions, password */
const PERMS=[['sale','Sale invoices'],['sret','Sale returns'],['purchase','Purchase invoices'],['pret','Purchase returns'],['transfer','Stock transfers'],['master','Add/edit products, customers, suppliers, locations'],['expenses','Expenses'],['edit','Edit/delete saved documents and payments'],['reports','Profit & Loss and Excel export'],['adjust','Stock In / Out (managers only)'],['stock_all','See stock of other locations']];
let TEAM=[];
const stBadge=s=>s==='paused'?'<span class="badge bad">Paused</span>':s==='pending'?'<span class="badge warn">Waiting for approval</span>':'<span class="badge ok">Active</span>';
const realShops=()=>MY.filter(m=>!m.support);
const isOwner=()=>{const m=me();return m.role==='owner'&&!m.support};

V.shops=()=>{
 const own=realShops().filter(m=>m.role==='owner');
 return['Shops and staff',`<div class="card"><div class="card-h">My shops</div><div class="tw"><table><thead><tr><th>Shop</th><th>My role</th><th>Status</th><th></th></tr></thead><tbody>${realShops().map(m=>`<tr><td>${esc(m.name)}${m.id===T?' <span class="badge ok">current</span>':''}</td><td>${esc(m.role)}</td><td>${stBadge(m.status)}</td><td class="act">${m.id===T?'':`<button class="btn sm" onclick="swShop('${m.id}')">Open</button>`}</td></tr>`).join('')}</tbody></table></div></div>
 <div class="card"><div class="card-h">Add another shop</div><div class="card-b hg"><div class="field"><label>Shop name</label><input class="input" id="ns"></div><div class="field"><label>&nbsp;</label><button class="btn primary" onclick="newShop()">Create shop</button></div></div></div>
 ${isOwner()?`<div class="card"><div class="card-h" style="display:flex;justify-content:space-between;align-items:center"><span>Staff of ${esc(me().name)}</span><button class="btn sm primary" onclick="tmForm(-1)">+ Add staff</button></div><div id="team"><p class="mu" style="padding:18px">Loading...</p></div></div>`:''}
 <div class="card"><div class="card-h">Change my password</div><div class="card-b hg"><div class="field"><label>New password</label><input class="input" id="np1" type="password" autocomplete="new-password"></div><div class="field"><label>Repeat new password</label><input class="input" id="np2" type="password" autocomplete="new-password"></div><div class="field"><label>&nbsp;</label><button class="btn primary" onclick="changePw()">Change password</button></div></div></div>
 ${own.length>1?`<div class="card"><div class="card-h" style="color:var(--bad)">Delete a shop</div><div class="card-b"><p class="mu" style="margin-bottom:12px">This deletes the shop with all its products, invoices, stock and payments. It cannot be undone. Open that shop first and download a backup before deleting.</p>
 <div class="hg"><div class="field"><label>Shop to delete</label><select class="input" id="dsh">${own.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div><div class="field"><label>Type the shop name to confirm</label><input class="input" id="dnm"></div><div class="field"><label>&nbsp;</label><button class="btn d" onclick="delShop()">Delete shop</button></div></div></div></div>`:''}`,
 ()=>{if(isOwner())teamLoad()}]};
addNav('Shops & Team','shops','Shops and staff');

async function newShop(){
 const n=$('#ns').value.trim();if(!n)return toast('Enter a shop name');
 const {data,error}=await sb.rpc('create_shop',{shop_name:n});if(error)return toast(dErr(error));
 await loadShops();await swShop(data);toast('Shop created')}
async function delShop(){
 const id=$('#dsh').value,m=MY.find(x=>x.id===id);if(!m)return;
 if($('#dnm').value.trim()!==m.name)return toast('Type the shop name exactly to confirm');
 if(!confirm('Permanently delete "'+m.name+'" and ALL its data? This cannot be undone.'))return;
 const {error}=await sb.rpc('delete_shop',{p_tenant:id});if(error)return toast(dErr(error));
 await loadShops();
 if(!MY.some(x=>x.id===T))T=MY[0].id;
 shopUI();await load();buildNav();toast('Shop deleted');go('shops')}
async function changePw(){
 const a=$('#np1').value,b=$('#np2').value;
 if(a.length<6)return toast('Password needs 6+ characters');
 if(a!==b)return toast('Passwords do not match');
 const {error}=await sb.auth.updateUser({password:a});if(error)return toast(error.message);
 $('#np1').value=$('#np2').value='';toast('Password changed')}

/* ---------- staff ---------- */
async function teamLoad(){
 const box=$('#team');if(!box)return;
 const {data,error}=await sb.rpc('list_team',{p_tenant:T});
 if(error){box.innerHTML='<div class="empty">'+esc(error.message)+'</div>';return}
 TEAM=data;const lab=Object.fromEntries(PERMS.map(p=>[p[0],p[1].split(' (')[0].split(',')[0]]));
 box.innerHTML=`<div class="tw"><table><thead><tr><th>Email</th><th>Role</th><th>Locations</th><th>Can do</th><th></th></tr></thead><tbody>${TEAM.map((m,i)=>`<tr><td>${esc(m.t_email)}${m.t_pending?' <span class="badge warn">invited</span>':''}</td><td>${esc(m.t_role)}</td><td style="white-space:normal">${m.t_locs?esc(m.t_locs.map(ln).join(', ')||'-'):'All'}</td><td style="white-space:normal;max-width:260px">${m.t_role==='owner'||!m.t_perms?'Everything':m.t_role==='viewer'?'View only':esc(m.t_perms.map(k=>lab[k]||k).join(', ')||'Nothing')}</td><td class="act">${m.t_role==='owner'?'':`<button class="btn sm" onclick="tmForm(${i})">Edit</button><button class="btn sm d" onclick="tmDel(${i})">Remove</button>`}</td></tr>`).join('')}</tbody></table></div>`}
function tmForm(i){
 const m=i>=0?TEAM[i]:{t_email:'',t_role:'cashier',t_perms:['sale','sret','transfer','stock_all'],t_locs:LF?[LF]:null},pp=m.t_perms,ll=m.t_locs,
  cb=(cls,v,txt,on,off)=>`<label style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px;margin:5px 0"><input type="checkbox" class="${cls}" value="${v}" ${on?'checked':''} ${off?'disabled':''}> ${txt}</label>`;
 openModal(`<div class="mbox"><h3>${i>=0?'Edit access':'Add staff'}</h3>
 <div class="field"><label>Email</label><input class="input" id="tm_e" value="${esc(m.t_email)}" ${i>=0?'readonly':''}></div>
 <div class="field"><label>Role (viewer = read only)</label><select class="input" id="tm_r">${['manager','cashier','viewer'].map(r=>`<option ${r===m.t_role?'selected':''}>${r}</option>`).join('')}</select></div>
 <div class="field"><label>Locations they can use</label>
  <label style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px"><input type="checkbox" id="tm_la" ${ll?'':'checked'} onchange="document.querySelectorAll('.tm_l').forEach(c=>c.disabled=this.checked)"> All locations</label>
  ${S.locations.map(l=>cb('tm_l',l.id,esc(l.name),ll&&ll.includes(l.id),!ll)).join('')}</div>
 <div class="field"><label>What they can do</label>
  <label style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:13px"><input type="checkbox" id="tm_pa" ${pp?'':'checked'} onchange="document.querySelectorAll('.tm_p').forEach(c=>c.disabled=this.checked)"> Everything</label>
  ${PERMS.map(([k,t])=>cb('tm_p',k,esc(t),pp&&pp.includes(k),!pp)).join('')}</div>
 <div class="mact"><button class="btn" onclick="mclose()">Cancel</button><button class="btn primary" onclick="tmSave()">Save</button></div></div>`)}
async function tmSave(){
 const em=$('#tm_e').value.trim().toLowerCase();if(!em)return toast('Enter an email');
 const all=$('#tm_la').checked,locs=all?null:[...document.querySelectorAll('.tm_l:checked')].map(c=>c.value);
 if(!all&&!locs.length)return toast('Choose at least one location');
 const pa=$('#tm_pa').checked,perms=pa?null:[...document.querySelectorAll('.tm_p:checked')].map(c=>c.value);
 const {error}=await sb.rpc('save_member',{p_tenant:T,p_email:em,p_role:$('#tm_r').value,p_perms:perms,p_locs:locs});
 if(error)return toast(dErr(error));
 mclose();toast('Saved');teamLoad()}
async function tmDel(i){
 const m=TEAM[i];if(!confirm('Remove '+m.t_email+' from this shop?'))return;
 const {error}=await sb.rpc('drop_member',{p_tenant:T,p_email:m.t_email});
 if(error)return toast(dErr(error));toast('Removed');teamLoad()}
