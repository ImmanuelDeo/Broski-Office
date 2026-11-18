/** Pure presentation model. No HTTP, task execution, memory writes or credentials. */
export const DEFAULT_TEAMS = [
  {id:'creative',name:'Creative Studio',color:'#bca2ff',agents:[{id:'nova',name:'Nova',role:'Clip Editor'},{id:'pixel',name:'Pixel',role:'Clip Editor'},{id:'sage',name:'Sage',role:'Brand Checker'}]},
  {id:'research',name:'Research Lab',color:'#82e1cd',agents:[{id:'atlas',name:'Atlas',role:'Research Analyst'},{id:'lyra',name:'Lyra',role:'Evidence Reviewer'}]},
  {id:'engineering',name:'Engineering',color:'#91bcff',agents:[{id:'axel',name:'Axel',role:'Software Engineer'},{id:'echo',name:'Echo',role:'Code Reviewer'}]},
  {id:'operations',name:'Operations',color:'#efbd79',agents:[{id:'orion',name:'Orion',role:'Task Planner'},{id:'mira',name:'Mira',role:'Quality Reviewer'}]}
];
export const SKINS = [
 {id:'eren',name:'Eren Yeager',hair:'#33271f',coat:'#485a49',shirt:'#d8d0bd',style:'bun'},
 {id:'shinei',name:'Shinei Nouzen',hair:'#182127',coat:'#303744',shirt:'#b5b1a7',style:'fringe'},
 {id:'asta',name:'Asta',hair:'#c8c6bc',coat:'#242934',shirt:'#897b52',style:'spikes',band:'#292c37'},
 {id:'deku',name:'Deku',hair:'#245942',coat:'#2c8e75',shirt:'#e9e2ce',style:'spikes'},
 {id:'choso',name:'Choso',hair:'#30282c',coat:'#665174',shirt:'#e2d8cf',style:'buns',mark:true},
 {id:'levi',name:'Levi Ackerman',hair:'#25272c',coat:'#697654',shirt:'#e4e0d3',style:'fringe',scarf:true},
 {id:'archer',name:'Archer',hair:'#dbd9d3',coat:'#a34449',shirt:'#343844',style:'spikes'},
 {id:'saber',name:'Saber',hair:'#d6b86c',coat:'#415ca2',shirt:'#d2d9df',style:'bun',scarf:true},
 {id:'lancer',name:'Lancer',hair:'#263e70',coat:'#315c9c',shirt:'#c2ced9',style:'tail'}
];
export function hash(s){let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function random(seed){let n=hash(seed);return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function makeLayout(teams=DEFAULT_TEAMS){
 const seen=new Set(),agentIds=new Set();let avatar=0;
 return teams.map((t,i)=>{
  if(!t.id||seen.has(t.id))throw Error('Team ID must be unique');seen.add(t.id);
  const agents=t.agents||[]; const width=Math.max(14,agents.length*3+3);
  const room={...t,width,depth:11,x:(i%2?1:-1)*(width/2+3),z:Math.floor(i/2)*14-7,obstacles:[],stations:[],workers:[]};
  const add=(x,z,w,d,type)=>room.obstacles.push({x:x+room.x,z:z+room.z,w,d,type});
  // All doors face the central aisle. Ambient workers remain inside their own room.
  agents.forEach((a,j)=>{
   if(a.id==null||agentIds.has(String(a.id)))throw Error('Agent ID must be unique and non-null');agentIds.add(String(a.id));
   const x=(j-(agents.length-1)/2)*3.15+room.x,z=room.z-2.7;
   add(x-room.x,-2.7,2.65,1.2,'desk');
   room.workers.push({...a,id:String(a.id),teamId:t.id,seat:{x,z:z+1.05},skin:SKINS[avatar++%SKINS.length]});
  });
  const rng=random(t.id+'-penthouse');
  const side=rng()>.5?1:-1;
  const items=[{kind:'beanbag',x:-4.7*side,z:2.8,w:1.55,d:1.55,dx:0,dz:-1.35},
   {kind:'arcade',x:4.8*side,z:3.35,w:1.15,d:1.05,dx:0,dz:1.0},
   {kind:'water',x:2.2*side,z:3.55,w:.7,d:.7,dx:0,dz:1},
   {kind:'plant',x:-6.1,z:-3.9,w:.65,d:.65}, {kind:'plant',x:6.1,z:-3.9,w:.65,d:.65},
   {kind:'plant',x:-1.8*side,z:4,w:.75,d:.75}];
  for(const p of items)p.z+=(rng()-.5)*.22;
  room.decor=items.map((p,k)=>({...p,id:t.id+'-'+p.kind+'-'+k,x:p.x+room.x,z:p.z+room.z}));
  for(const p of items){add(p.x,p.z,p.w,p.d,p.kind);if(p.dx!==undefined)room.stations.push({id:t.id+'-'+p.kind,kind:p.kind,x:room.x+p.x+p.dx,z:room.z+p.z+p.dz,look:{x:room.x+p.x,z:room.z+p.z}});}
  // Lamp bases and side tables also participate in navigation.
  for(const dx of [-5.8,5.8])add(dx,.1,.44,.44,'lamp');
  const bean=items.find(p=>p.kind==='beanbag');add(bean.x+1.3,bean.z+.35,.76,.76,'side-table');
  room.stations.push({id:t.id+'-talk-a',kind:'talk',x:room.x-.6,z:room.z+.8,look:{x:room.x+.6,z:room.z+.8}}, {id:t.id+'-talk-b',kind:'talk',x:room.x+.6,z:room.z+.8,look:{x:room.x-.6,z:room.z+.8}});
  return room;
 });
}
export function walkable(room,p,radius=.3,extra=[]){
 if(p.x<room.x-room.width/2+.55||p.x>room.x+room.width/2-.55||p.z<room.z-room.depth/2+.55||p.z>room.z+room.depth/2-.55)return false;
 return ![...room.obstacles,...extra].some(o=>Math.abs(p.x-o.x)<o.w/2+radius&&Math.abs(p.z-o.z)<o.d/2+radius);
}
export function segmentClear(room,a,b,extra=[]){const n=Math.ceil(dist(a,b)/.12);for(let i=0;i<=n;i++){const f=n?i/n:0;if(!walkable(room,{x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f},.3,extra))return false;}return true;}
/** Four-neighbour A*. No diagonal corner cutting; every final segment validated. */
export function route(room,start,goal,extra=[]){
 if(!walkable(room,start,.3,extra)||!walkable(room,goal,.3,extra))return [];
 if(segmentClear(room,start,goal,extra))return [{...goal}];
 const step=.35, ox=room.x-room.width/2+.6,oz=room.z-room.depth/2+.6;
 const nx=Math.floor((room.width-1.2)/step)+1,nz=Math.floor((room.depth-1.2)/step)+1;
 const pt=k=>({x:ox+(k%nx)*step,z:oz+Math.floor(k/nx)*step});
 function near(p){let best=-1,d=Infinity;for(let k=0;k<nx*nz;k++){const q=pt(k),dd=dist(p,q);if(dd<d&&segmentClear(room,p,q,extra)){best=k;d=dd;}}return best;}
 const s=near(start),g=near(goal);if(s<0||g<0)return [];
 const open=new Set([s]),prev=new Map(),cost=new Map([[s,0]]),closed=new Set();
 while(open.size){let c=-1,b=Infinity;for(const k of open){const f=cost.get(k)+dist(pt(k),pt(g));if(f<b){b=f;c=k;}}
  if(c===g){const path=[{...goal}];for(let k=g;k!==s;k=prev.get(k))path.unshift(pt(k));path.unshift(pt(s));return path;}
  open.delete(c);closed.add(c);
  for(const k of [c-1,c+1,c-nx,c+nx]){if(k<0||k>=nx*nz||closed.has(k)||dist(pt(c),pt(k))>step*1.01||!segmentClear(room,pt(c),pt(k),extra))continue;
   const n=cost.get(c)+step;if(n<(cost.get(k)??Infinity)){prev.set(k,c);cost.set(k,n);open.add(k);}}
 }
 return [];
}
export function normalizeFrame(frame){
 if(!frame||!Array.isArray(frame.agents))throw Error('Expected presentation frame.agents array');
 const seen=new Set();
 const agents=frame.agents.map(a=>{
  if(typeof a.id!=='string'||seen.has(a.id))throw Error('Invalid/duplicate agent ID');seen.add(a.id);
  if(!['idle','working','reviewing','offline','error','unknown'].includes(a.status))throw Error('Unknown presentation status: '+a.status);
  return {...a,taskId:a.taskId==null?null:String(a.taskId)};
 });
 return {agents,memoryBytes:Number.isFinite(frame.memoryBytes)?Math.max(0,frame.memoryBytes):null,mode:frame.mode==='live'?'live':'demo'};
}
export class OfficeSimulation {
 constructor(rooms){this.rooms=rooms;this.time=0;this.reservations=new Map();this.pulses=[];this.eventIds=new Map();this.rng=random('ambient-v2');this.workers=rooms.flatMap(r=>r.workers.map((a,i)=>({...a,room:r,pos:{...a.seat},yaw:0,pose:'seated',status:'idle',taskId:null,path:[],goal:null,station:null,partner:null,timer:2+i*2+this.rng()*5,blocked:0})));}
 release(w){if(w.station)this.reservations.delete(w.station.id);w.station=null;if(w.partner){const p=this.workers.find(a=>a.id===w.partner);if(p){p.partner=null;p.timer=0;}w.partner=null;}}
 obstacles(w,target=w.goal||w.seat){return [...w.room.workers.filter(a=>a.id!==w.id).map(a=>({...a.seat,w:.65,d:.65})),...this.workers.filter(a=>a!==w&&a.room===w.room).map(a=>({...a.pos,w:.6,d:.6}))];}
 go(w,target,pose,station=null){
  const path=route(w.room,w.pos,target,this.obstacles(w,target));
  if(!path.length)return false;
  this.release(w);w.path=path;w.goal={...target};w.arrivalPose=pose;w.pose='walking';w.station=station;w.blocked=0;
  if(station)this.reservations.set(station.id,w.id);return true;
 }
 apply(frame){
    const f=normalizeFrame(frame),byId=new Map(f.agents.map(a=>[a.id,a]));
  for(const w of this.workers){const a=byId.get(w.id)||{status:'unknown',taskId:null};const changed=w.status!==a.status||w.taskId!==a.taskId;w.status=a.status;w.taskId=a.taskId;
   if(changed){this.release(w);w.timer=5; if(dist(w.pos,w.seat)>.05){if(!this.go(w,w.seat,'seated')){w.path=[];w.pose='standing';w.goal={...w.seat};w.arrivalPose='seated';}}else{w.path=[];w.goal=null;w.pose='seated';}}
  }return f;
 }
 knowledge(event){
  if(!event||typeof event.id!=='string'||!['snapshot','memory-read'].includes(event.kind))return false;
  if(this.eventIds.has(event.id)||!this.workers.some(w=>w.id===event.agentId))return false;
  this.eventIds.set(event.id,this.time);if(this.eventIds.size>512)this.eventIds.delete(this.eventIds.keys().next().value);
  this.pulses.push({id:event.id,agentId:event.agentId,kind:event.kind,age:0,duration:2.7});if(this.pulses.length>24)this.pulses.shift();return true;
 }
 tick(dt,motion=true){
  if(!motion)return;dt=Math.min(Math.max(dt,0),.1);this.time+=dt;
  for(const p of this.pulses)p.age+=dt;this.pulses=this.pulses.filter(p=>p.age<p.duration);
  for(const w of this.workers){
   if(w.path.length){const next=w.path[0],d=dist(w.pos,next),s=Math.min(d,dt*1.65),n={x:w.pos.x+(next.x-w.pos.x)*(d?s/d:0),z:w.pos.z+(next.z-w.pos.z)*(d?s/d:0)};
    const occupied=this.workers.some(a=>a!==w&&a.room===w.room&&Math.abs(a.pos.x-n.x)<.6&&Math.abs(a.pos.z-n.z)<.6);
    if(occupied){w.blocked+=dt;if(w.blocked>1){const obstacles=this.obstacles(w);w.path=route(w.room,w.pos,w.goal,obstacles);w.blocked=0;}continue;}
    if(!segmentClear(w.room,w.pos,n)){w.path=[];continue;}w.yaw=Math.atan2(-(next.x-w.pos.x),-(next.z-w.pos.z));w.pos=n;
    if(d<=s+.001)w.path.shift();if(!w.path.length){w.pose=w.arrivalPose;w.timer=5+this.rng()*7;w.goal=null;w.yaw=w.station?Math.atan2(-(w.station.look.x-w.pos.x),-(w.station.look.z-w.pos.z)):0;}
    continue;
   }
   // If obstructed, wait and retry. Never teleport back to a workstation.
   if(w.goal){w.blocked+=dt;if(w.blocked>.8){w.path=route(w.room,w.pos,w.goal,this.obstacles(w));w.blocked=0;}continue;}
   if(w.status!=='idle')continue;
   w.timer-=dt;if(w.timer>0)continue;
   if(w.station){if(w.partner){const p=this.workers.find(a=>a.id===w.partner);if(p?.path.length){w.timer=1;continue;}}this.go(w,w.seat,'seated');w.timer=2;continue;}
   const available=w.room.stations.filter(s=>!this.reservations.has(s.id)&&s.kind!=='talk');
   const peer=this.workers.find(a=>a!==w&&a.room===w.room&&a.status==='idle'&&!a.station&&!a.path.length&&!a.goal);
   const talk=w.room.stations.filter(s=>s.kind==='talk');
   if(peer&&this.rng()<.4&&talk.every(s=>!this.reservations.has(s.id))){
    const pair=dist(w.pos,talk[0])+dist(peer.pos,talk[1])<=dist(w.pos,talk[1])+dist(peer.pos,talk[0])?talk:[talk[1],talk[0]];
    if(this.go(w,pair[0],'talk',pair[0])){if(this.go(peer,pair[1],'talk',pair[1])){w.partner=peer.id;peer.partner=w.id;}else{this.go(w,w.seat,'seated');}}w.timer=3;
   }else{const s=available[Math.floor(this.rng()*available.length)];if(s)this.go(w,s,s.kind,s);w.timer=3;}
  }
 }
}
export function timePalette(hour){
 const keys=[{h:0,sky:'#0c142b',fog:'#142236',sun:'#88afff',intensity:.55,ambient:1,windows:1},
 {h:6,sky:'#a2bfcd',fog:'#b9c9cb',sun:'#ffe2b1',intensity:2.5,ambient:1.9,windows:.1},
 {h:12,sky:'#b7cfd8',fog:'#aec8ce',sun:'#fff2d7',intensity:2.6,ambient:2,windows:0},
 {h:17,sky:'#b6909e',fog:'#c4a2a7',sun:'#ffc28c',intensity:2.3,ambient:1.7,windows:.55},
 {h:20,sky:'#0c142b',fog:'#142236',sun:'#88afff',intensity:.55,ambient:1,windows:1},{h:24,sky:'#0c142b',fog:'#142236',sun:'#88afff',intensity:.55,ambient:1,windows:1}];
 hour=((hour%24)+24)%24;let i=0;while(keys[i+1].h<hour)i++;return {a:keys[i],b:keys[i+1],t:(hour-keys[i].h)/(keys[i+1].h-keys[i].h)};
}
