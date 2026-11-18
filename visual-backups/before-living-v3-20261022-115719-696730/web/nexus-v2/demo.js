import {NexusOfficeView} from './view.js';
import {DEFAULT_TEAMS} from './model.js';
const $=id=>document.getElementById(id);let view,taskSerial=0,selected='brain',mode='idle',disposed=false;
const descriptions=['Produksi kreatif dan pemeriksaan brand.','Riset, bukti, dan pemeriksaan sumber.','Implementasi, pengujian, dan code review.','Perencanaan dan koordinasi keluaran.'];
const logs=[];
function event(text){logs.unshift({text,time:new Date().toLocaleTimeString('id-ID')});logs.splice(5);$('events').replaceChildren(...logs.map(e=>{const li=document.createElement('li');li.textContent=e.text;const t=document.createElement('time');t.textContent=e.time+' · visual simulation';li.append(t);return li;}));}
function frame(){return {mode:'demo',memoryBytes:3588,agents:view.sim.workers.map((w,i)=>({id:w.id,status:mode==='work'&&[0,3,5].includes(i)?'working':'idle',taskId:mode==='work'&&[0,3,5].includes(i)?'demo-'+taskSerial+'-'+i:null}))};}
function inspect(object){selected=object.kind==='agent'?object.id:object.kind;const w=view.sim.workers.find(a=>a.id===object.id),room=DEFAULT_TEAMS.find(t=>t.id===object.id);
 const title=w?w.name:room?room.name:'The shared brain',sub=w?w.skin.name+' · low-poly skin':room?'Ruang tim dengan dekorasi terarah':'Konteks bersama untuk setiap tim.';
 const info=w?[['Role',w.role],['Task status',w.status],['Ambient action',w.pose],['Identity',w.id],['Skin',w.skin.name]]:room?[['Agents',room.agents.length],['Ruang', '14 × 11 unit'],['Dekorasi','Bean bag · Arcade · Water'],['Gerak','Collision-aware']]:[['Ukuran demo','3.588 bytes'],['Sumber demo','2 sources'],['Transfer','Partikel knowledge'],['Penyimpanan','Tidak diakses preview']];
 const root=$('inspector');root.replaceChildren();const card=document.createElement('div');card.className='inspector-card';const icon=document.createElement('div');icon.className='brain-icon';icon.textContent=w?'♙':room?'⌂':'◈';const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=sub;card.append(icon,h,p);
 if(!w&&!room){const numbers=document.createElement('div');numbers.className='inspector-numbers';numbers.innerHTML='<div><strong>3.5 KiB</strong><small>DEMO MEMORY</small></div><div><strong>2</strong><small>DEMO SOURCES</small></div>';card.append(numbers);}root.append(card);
 const list=document.createElement('div');list.className='detail-list';for(const [a,b]of info){const d=document.createElement('div');d.className='detail';const label=document.createElement('span'),v=document.createElement('b');label.textContent=a;v.textContent=b;d.append(label,v);list.append(d);}root.append(list);
 const btn=document.createElement('button');btn.className='inspector-action';btn.textContent=w||room?'Fokus kamera ↗':'Simulasikan knowledge pulse ↗';btn.onclick=()=>{if(w||room)view.focus(object.id);else{view.knowledge({id:'manual-'+Date.now(),agentId:'nova',kind:'memory-read'});event('Demo: knowledge menuju Nova');}};root.append(btn);
}
try{
 view=new NexusOfficeView($('office'),{onInspect:inspect,timeMode:'manual',hour:17.5});$('loading').remove();window.nexusPreview=view;
 view.update(frame());inspect({kind:'brain'});event('Penthouse ready · 9 agents idle');
 DEFAULT_TEAMS.forEach((t,i)=>{const b=document.createElement('button');b.className='team-card';b.style.setProperty('--accent',t.color);const h=document.createElement('h3');h.textContent=t.name;const p=document.createElement('p');p.textContent=descriptions[i];const small=document.createElement('small');small.textContent=t.agents.length+' agents · inspect room ↗';b.append(h,p,small);b.onclick=()=>{inspect({kind:'team',id:t.id});view.focus(t.id);};$('teams').append(b);});
 document.querySelectorAll('[data-hour]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-hour]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');const h=b.dataset.hour;view.setTime(h==='auto'?'auto':'manual',Number(h));$('environment').textContent=h==='auto'?'LOCAL TIME':h==='8'?'MORNING LIGHT':h==='22'?'AFTER HOURS':'GOLDEN HOUR';});
 $('home').onclick=()=>view.home();$('top').onclick=()=>view.top();$('nav-office').onclick=()=>view.home();$('nav-brain').onclick=()=>inspect({kind:'brain'});$('nav-activity').onclick=()=>{event('Activity panel · log simulasi visual');document.querySelector('aside').style.display='block';document.querySelector('aside').scrollIntoView({behavior:'smooth'});};
 $('motion').onclick=()=>{view.setMotion(!view.motion);$('motion').setAttribute('aria-pressed',String(view.motion));$('motion').textContent=view.motion?'Ⅱ Motion':'▶ Motion';};
 $('task').onclick=()=>{mode=mode==='idle'?'work':'idle';taskSerial++;view.update(frame());$('working').textContent=mode==='work'?'3':'0';$('task').textContent=mode==='work'?'✓ Akhiri simulasi':'＋ Simulasi task';
  if(mode==='work'){for(const id of ['nova','atlas','axel'])view.knowledge({id:'demo-start-'+taskSerial+'-'+id,agentId:id,kind:'snapshot'});event('Demo task dimulai · 3 snapshot knowledge');}else event('Demo task selesai · ambient activity aktif');
 };
 window.addEventListener('pagehide',()=>{disposed=true;view.dispose();},{once:true});
 const inspectorTimer=setInterval(()=>{if(disposed){clearInterval(inspectorTimer);return;}if(view.sim.workers.some(w=>w.id===selected))inspect({kind:'agent',id:selected});},1600);
}catch(error){$('loading').textContent='WebGL tidak tersedia. Preview 3D memerlukan browser dengan hardware acceleration. Modul upgrade belum dipasang ke office lama.';$('loading').className='error';console.error(error);}
