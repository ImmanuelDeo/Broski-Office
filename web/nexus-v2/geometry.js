import * as T from './vendor/three.module.js';
export class Kit {
 constructor(){this.materials=new Map();this.geometries=new Map();}
 mat(color,emissive=false,opacity=1){const k=[color,emissive,opacity].join();if(!this.materials.has(k))this.materials.set(k,new T.MeshStandardMaterial({color,roughness:.72,metalness:.08,flatShading:true,transparent:opacity<1,opacity,depthWrite:opacity===1,...(emissive?{emissive:color,emissiveIntensity:.65}:{})}));return this.materials.get(k);}
 geo(key,fn){if(!this.geometries.has(key))this.geometries.set(key,fn());return this.geometries.get(key);}
 mesh(parent,geo,color,pos,scale=[1,1,1],emissive=false,opacity=1){const m=new T.Mesh(geo,this.mat(color,emissive,opacity));m.position.set(...pos);m.scale.set(...scale);m.castShadow=opacity===1;m.receiveShadow=true;parent.add(m);return m;}
 box(p,c,pos,size,glow=false,alpha=1){return this.mesh(p,this.geo('box',()=>new T.BoxGeometry(1,1,1)),c,pos,size,glow,alpha);}
 ball(p,c,pos,size=[1,1,1],detail=1){return this.mesh(p,this.geo('ico'+detail,()=>new T.IcosahedronGeometry(1,detail)),c,pos,size);}
 cyl(p,c,pos,r,h,glow=false){return this.mesh(p,this.geo('cylinder',()=>new T.CylinderGeometry(1,1,1,16)),c,pos,[r,h,r],glow);}
 ring(p,c,pos,r,t=.025){const m=this.mesh(p,this.geo('ring'+r+','+t,()=>new T.TorusGeometry(r,t,6,64)),c,pos,[1,1,1],true);m.rotation.x=Math.PI/2;return m;}
 dispose(){for(const g of this.geometries.values())g.dispose();for(const m of this.materials.values())m.dispose();}
}
export function plant(k,p,x,z,size=1){
 k.cyl(p,'#b4b7a8',[x,.26*size,z],.28*size,.52*size);k.cyl(p,'#665844',[x,.63*size,z],.035*size,.75*size);
 for(let i=0;i<5;i++){const a=i*2.4;k.ball(p,i%2?'#487965':'#64927a',[x+Math.cos(a)*.19*size,(.9+i*.08)*size,z+Math.sin(a)*.19*size],[.25*size,.43*size,.22*size],0);}
}
export function decor(k,p,item,color){const {x,z,kind}=item;
 if(kind==='plant'){plant(k,p,x,z,1.2);return;}
 if(kind==='beanbag'){
  k.cyl(p,'#324449',[x,.025,z],1.1,.04);k.ball(p,color,[x,.34,z],[.78,.4,.78]);k.ball(p,color,[x,.57,z+.35],[.72,.5,.35]);k.box(p,'#e0d5bf',[x-.23,.55,z-.1],[.35,.12,.4]);
  k.cyl(p,'#b19376',[x+1.3,.35,z+.35],.38,.07);k.cyl(p,'#27333b',[x+1.3,.17,z+.35],.055,.34);k.cyl(p,'#e6ddcb',[x+1.3,.44,z+.35],.09,.13);
 }else if(kind==='arcade'){
  k.box(p,'#243040',[x,.68,z],[1.05,1.36,.9]);k.box(p,color,[x,1.62,z+.2],[1.08,.62,.55]);
  k.box(p,'#0c1826',[x,1.6,z-.09],[.84,.45,.04]);k.box(p,'#72e8c3',[x,1.6,z-.12],[.66,.29,.03],true);
  for(let i=0;i<4;i++)k.box(p,'#e9e8ae',[x-.23+i*.15,1.56+(i%2)*.09,z-.15],[.08,.05,.015],true);
  k.box(p,'#3f5261',[x,1.15,z-.34],[1.12,.14,.48]);k.cyl(p,'#101b21',[x-.24,1.28,z-.4],.04,.18);k.ball(p,'#eb8c91',[x-.24,1.39,z-.4],[.07,.07,.07]);
  k.cyl(p,'#f5c374',[x+.2,1.25,z-.45],.07,.04);k.box(p,color,[x,.2,z-.47],[.68,.09,.02],true);
 }else if(kind==='water'){
  k.box(p,'#d0d7d2',[x,.58,z],[.62,1.16,.63]);k.cyl(p,'#75bacc',[x,1.44,z],.23,.52);k.box(p,'#283c49',[x,.85,z-.33],[.42,.32,.025]);
  k.box(p,'#76d4e5',[x-.11,.87,z-.37],[.08,.06,.08]);k.box(p,'#e89992',[x+.11,.87,z-.37],[.08,.06,.08]);k.cyl(p,'#eff0dd',[x,.66,z-.36],.075,.13);
 }
}
export function desk(k,p,x,z,color){
 k.box(p,'#b9bdb3',[x,1.05,z],[2.65,.12,1.2]);k.box(p,'#657876',[x,1.12,z],[2.55,.025,1.08]);
 for(const dx of [-1.05,1.05])k.box(p,'#344b50',[x+dx,.5,z],[.12,1,.83]);
 k.box(p,'#1b2c36',[x,1.62,z-.15],[1.25,.72,.1]);k.box(p,'#172c40',[x,1.62,z-.21],[1.13,.59,.02]);
 // Screen faces worker toward +z.
 k.box(p,'#162632',[x,1.62,z-.085],[1.1,.58,.02]);
 for(let i=0;i<4;i++){k.box(p,i%2?color:'#6e8e9e',[x-.12+(i%2)*.12,1.8-i*.12,z-.069],[.65-(i%3)*.12,.025,.015],true);}
 k.box(p,'#34434e',[x,1.23,z-.15],[.08,.28,.1]);k.box(p,'#34434e',[x,1.13,z-.12],[.46,.04,.27]);
 k.box(p,'#24363c',[x,1.135,z+.4],[.8,.045,.28]);for(let i=0;i<7;i++)k.box(p,'#7c9695',[x-.3+i*.1,1.16,z+.4],[.06,.01,.18]);
 k.ball(p,'#dfd7b9',[x+.63,1.16,z+.4],[.09,.045,.12]);k.cyl(p,color,[x-.95,1.23,z+.2],.1,.22);
 const chair=new T.Group();chair.position.set(x,0,z+1.05);p.add(chair);
 k.cyl(chair,'#263740',[0,.18,0],.07,.35);k.box(chair,'#293d48',[0,.5,0],[.63,.15,.62]);k.box(chair,'#344c56',[0,.89,.28],[.63,.77,.12]);
 for(const s of [-1,1]){k.box(chair,'#24343c',[s*.36,.71,0],[.08,.08,.5]);k.box(chair,'#24343c',[s*.36,.53,.15],[.06,.35,.06]);k.box(chair,'#263740',[s*.2,.09,0],[.45,.07,.08]);}
 return chair;
}
function limb(k,parent,x,y,color,skin,leg=false){
 const root=new T.Group();root.position.set(x,y,0);parent.add(root);const len=leg?.34:.3;
 k.box(root,color,[0,-len/2,0],leg?[.15,len,.18]:[.14,len,.16]);const joint=new T.Group();joint.position.y=-len;root.add(joint);
 k.box(joint,leg?color:skin,[0,-len/2,0],leg?[.14,len,.17]:[.12,len,.13]);
 let wrist=null;if(leg)k.box(joint,'#17232d',[0,-len,-.06],[.18,.13,.3]);else{wrist=new T.Group();wrist.position.y=-len;joint.add(wrist);k.ball(wrist,skin,[0,0,0],[.09,.07,.09],0);for(let f=0;f<3;f++)k.box(wrist,skin,[(f-1)*.045,-.055,-.045],[.03,.07,.045]);}
 return {root,joint,wrist};
}
export function character(k,skin){
 const root=new T.Group(),body=new T.Group();root.add(body);const flesh='#d5ac91';
 k.box(body,skin.coat,[0,.25,0],[.52,.58,.3]);k.box(body,skin.shirt,[0,.26,-.16],[.21,.5,.02]);k.box(body,'#25323b',[0,-.06,0],[.48,.16,.29]);
 const head=new T.Group();head.position.y=.76;body.add(head);
 k.box(head,flesh,[0,0,0],[.42,.46,.38]);k.box(head,skin.hair,[0,.22,.015],[.46,.17,.42]);k.box(head,skin.hair,[0,.08,.18],[.45,.36,.09]);
 for(const side of [-1,1]){k.box(head,skin.hair,[side*.2,.11,0],[.08,.3,.39]);k.box(head,'#23343a',[side*.1,-.01,-.199],[.055,.04,.015]);}
 if(skin.style==='spikes')for(let i=0;i<7;i++){const m=k.mesh(head,k.geo('hairspike',()=>new T.ConeGeometry(.1,.3,4)),skin.hair,[(i%4-.9)*.12,.36,-.08+Math.floor(i/4)*.18]);m.rotation.z=(i-3)*.15;}
 if(skin.style==='bun'||skin.style==='buns')for(const x of skin.style==='buns'?[-.24,.24]:[0])k.ball(head,skin.hair,[x,.22,.28],[.15,.17,.14],0);
 if(skin.style==='fringe')for(let i=0;i<3;i++){const m=k.box(head,skin.hair,[-.13+i*.1,.15-i*.025,-.2],[.1,.22,.055]);m.rotation.z=-.24;}
 if(skin.style==='tail')k.box(head,skin.hair,[0,-.03,.29],[.13,.45,.12]);
 if(skin.band)k.box(head,skin.band,[0,.14,-.22],[.46,.08,.035]);
 if(skin.mark)k.box(head,'#634452',[0,-.07,-.201],[.31,.035,.02]);
 if(skin.scarf)k.box(body,'#e8e1ce',[0,.52,-.17],[.3,.12,.12]);
 const arms=[limb(k,body,-.34,.47,skin.coat,flesh),limb(k,body,.34,.47,skin.coat,flesh)];
 const legs=[limb(k,body,-.15,-.1,'#293441',flesh,true),limb(k,body,.15,-.1,'#293441',flesh,true)];
 const cup=k.cyl(arms[1].joint,'#e7dfc8',[0,-.29,-.07],.09,.15);cup.visible=false;
 const glow=k.ball(root,'#a9ffe1',[0,2.08,0],[.12,.16,.12],0);glow.material=k.mat('#a9ffe1',true);glow.visible=false;
 return {root,body,head,arms,legs,cup,glow};
}
export function poseCharacter(c,w,t,dt,moving=true){
 const seated=w.pose==='seated'||w.pose==='beanbag'; const typing=w.pose==='seated'&&['working','reviewing'].includes(w.status);
 const walking=w.pose==='walking'&&w.path.length>0;const a=moving?1:0;
 const ease=1-Math.exp(-dt*12);
 const lounging=w.pose==='beanbag'&&w.station;
 const tx=lounging?w.station.look.x:w.pos.x,tz=lounging?w.station.look.z:w.pos.z;
 c.root.position.x+=(tx-c.root.position.x)*ease;c.root.position.z+=(tz-c.root.position.z)*ease;c.root.position.y=.25;
 let d=(lounging?0:w.yaw)-c.root.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));c.root.rotation.y+=d*ease;
 const blend=(o,k,v)=>o[k]+=(v-o[k])*ease;
 blend(c.body.position,'y',seated?.64:.85);blend(c.body.rotation,'x',w.pose==='beanbag'?-.22:typing?.04:0);
 blend(c.head.rotation,'x',typing?.08:0);blend(c.head.rotation,'y',w.pose==='talk'&&a?Math.sin(t*.9)*.1:0);
 for(let i=0;i<2;i++){
  const phase=t*9+i*Math.PI,arm=c.arms[i],leg=c.legs[i];
  let upper=typing?1.32:walking?Math.sin(phase)*.38:0,fore=typing?.72:0;
  if(w.pose==='arcade'){upper=.8;fore=.8+Math.sin(t*8+i)*.1*a;}
  if(w.pose==='water'&&i===1){upper=1.9;fore=.45;}
  if(w.pose==='talk'&&i===1){upper=.6+Math.sin(t*2)*.2*a;fore=.7;}
  blend(arm.root.rotation,'x',upper+(typing?Math.sin(t*19+i*2)*.07*a:0));blend(arm.joint.rotation,'x',fore+(typing?Math.sin(t*23+i)*.09*a:0));
  if(arm.wrist)blend(arm.wrist.rotation,'x',typing?Math.sin(t*21+i*2)*.16*a:0);
  blend(leg.root.rotation,'x',seated?Math.PI/2:walking?-Math.sin(phase)*.42:0);blend(leg.joint.rotation,'x',seated?-Math.PI/2:walking?-.1-Math.max(0,Math.sin(phase))*.3:0);
 }
 c.cup.visible=w.pose==='water';
}
