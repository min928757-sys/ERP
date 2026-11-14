'use strict';
/* Landscape option for A4 / A5 printouts */
let PVO='portrait';
document.head.insertAdjacentHTML('beforeend','<style>.pv.p-a4.land{width:273mm}.pv.p-a5.land{width:190mm}#print .pv.p-a4.land,#print .pv.p-a5.land{width:100%}</style>');

/* add the "land" class when landscape is chosen */
const _pvR10=pvRender;
pvRender=function(m,st,paper){
 let h=_pvR10(m,st,paper);
 if(st&&st.orient==='landscape'&&(paper==='a4'||paper==='a5'))h=h.replace('class="pv ','class="pv land ');
 return h};

/* tell the browser the page orientation */
pvPage=function(paper){
 let s=document.getElementById('pgstyle');
 if(!s){s=document.createElement('style');s.id='pgstyle';document.head.appendChild(s)}
 const L=PVO==='landscape'?' landscape':'';
 s.textContent={a4:'@page{size:A4'+L+';margin:12mm}',a5:'@page{size:A5'+L+';margin:10mm}','80':'@page{size:80mm auto;margin:3mm}','58':'@page{size:58mm auto;margin:2mm}'}[paper]||''};
const _pvPM10=pvPrintModel;
pvPrintModel=function(m,paper,st){
 const s=st||pvS();
 PVO=(paper==='a4'||paper==='a5')?(s.orient||'portrait'):'portrait';
 _pvPM10(m,paper,s)};

/* the choice in Print settings */
const _pvForm10=pvForm;
pvForm=function(){
 const h=_pvForm10(),dis=isOwner()?'':'disabled',ls=PVD&&PVD.orient==='landscape',
  o=`<div class="field"><label>Orientation (A4 / A5)</label><select class="input" ${dis} onchange="pvSet('orient',this.value)"><option value="portrait" ${ls?'':'selected'}>Portrait (upright)</option><option value="landscape" ${ls?'selected':''}>Landscape (wide)</option></select></div>`;
 return h.replace('<div class="field"><label>Accent colour',o+'<div class="field"><label>Accent colour')};
