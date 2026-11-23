import * as T from './vendor/three.module.js';
import {SKINS} from './roster.js';
const geo={box:new T.BoxGeometry(1,1,1),ball:new T.IcosahedronGeometry(.5,2),cylinder:new T.CylinderGeometry(.5,.5,1,18),cone:new T.ConeGeometry(.5,1,14)};
const mats=new Map();
export function material(color,glow=false,smooth=false){const k=color+glow+smooth;if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color,roughness:smooth?.68:.9,metalness:smooth?.05:.08,flatShading:!smooth,...(glow?{emissive:color,emissiveIntensity:.7}:{})}));return mats.get(k);}
export function shape(parent,type,color,pos,scale,glow=false){const m=new T.Mesh(geo[type],material(color,glow,type!=='box'));m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d,g=false)=>shape(p,'box',c,[x,y,z],[w,h,d],g);
const texCache=new Map();
function texture(kind){
  if(texCache.has(kind))return texCache.get(kind);
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  if(kind==='stone'){
    x.fillStyle='#a49b8b';x.fillRect(0,0,256,256);
    x.strokeStyle='rgba(72,66,58,.45)';x.lineWidth=2;
    for(let i=0;i<=256;i+=64){x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke();x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();}
    for(let i=0;i<2600;i++){const v=196-Math.random()*44;x.fillStyle='rgba('+v+','+(v-6)+','+(v-16)+','+(Math.random()*.45).toFixed(2)+')';const s=1+Math.random()*3;x.fillRect(Math.random()*256,Math.random()*256,s,s);}
  }else if(kind==='wood'){
    x.fillStyle='#b3a184';x.fillRect(0,0,256,256);
    for(let i=0;i<256;i+=32){x.fillStyle='rgba('+(120+Math.random()*40).toFixed(0)+','+(100+Math.random()*26).toFixed(0)+','+(70+Math.random()*22).toFixed(0)+',.3)';x.fillRect(0,i,256,32);x.fillStyle='rgba(58,44,30,.32)';x.fillRect(0,i,256,2);}
    for(let i=0;i<900;i++){x.fillStyle='rgba(90,72,52,'+(Math.random()*.16).toFixed(2)+')';x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*8,1);}
  }else{
    x.fillStyle='#4d6a3f';x.fillRect(0,0,256,256);
    for(let i=0;i<5600;i++){const g=88+Math.random()*72;x.fillStyle='rgba('+Math.round(g*.52)+','+Math.round(g)+','+Math.round(g*.4)+','+(Math.random()*.5).toFixed(2)+')';x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*2,1+Math.random()*3);}
    for(let i=0;i<28;i++){x.fillStyle='rgba(56,72,42,.32)';x.beginPath();x.arc(Math.random()*256,Math.random()*256,4+Math.random()*12,0,6.283);x.fill();}
  }
  const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
  t.repeat.set(kind==='stone'?7:kind==='wood'?3:52,kind==='stone'?6:kind==='wood'?6:52);
  texCache.set(kind,t);return t;
}
function surf(parent,kind,x,y,z,w,h,d,tint='#ffffff'){
  const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({map:texture(kind),color:tint,roughness:kind==='stone'?.96:.86,metalness:.02}));
  m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;
}
function plant(p,x,z,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);p.add(g);shape(g,'cylinder','#dedac4',[0,.27,0],[.48,.55,.48]);box(g,'#645943',0,.9,0,.08,1.1,.08);for(let i=0;i<4;i++)shape(g,'ball',i%2?'#57886d':'#395e50',[Math.sin(i*2)*.22,1.1+i*.15,Math.cos(i*2)*.22],[.7,.9,.65]);}
function tree(p,x,z,s=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);p.add(g);
  shape(g,'cylinder','#5a4630',[0,2.2,0],[.44,4.4,.44]);
  shape(g,'ball','#3d6742',[0,4.9,0],[3.6,2.7,3.6]);
  shape(g,'ball','#4b7a4c',[.95,4.3,.6],[2.3,2,2.3]);
  shape(g,'ball','#35593c',[-.85,4.6,-.55],[2.1,1.8,2.1]);}
function barrel(p,x,z,s=1,rot=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;g.scale.setScalar(s);p.add(g);
  shape(g,'cylinder','#7a5a38',[0,.45,0],[.8,.9,.8]);
  shape(g,'cylinder','#4a3b2a',[0,.72,0],[.82,.07,.82]);
  shape(g,'cylinder','#4a3b2a',[0,.2,0],[.82,.07,.82]);}
function crate(p,x,y,z,s=1,rot=0){const g=new T.Group();g.position.set(x,y,z);g.rotation.y=rot;g.scale.setScalar(s);p.add(g);
  box(g,'#8a6a44',0,.42,0,.9,.84,.9);
  for(const s2 of [-1,1]){box(g,'#6b5233',s2*.44,.42,0,.07,.86,.95);box(g,'#6b5233',0,.42,s2*.44,.95,.86,.07);}
  box(g,'#9c7a4e',0,.87,0,.94,.07,.94);}
function fenceRun(p,x1,z1,x2,z2,h=1.15){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),n=Math.max(2,Math.round(len/2.4));
  for(let i=0;i<=n;i++){const t=i/n;box(p,'#6e5638',x1+dx*t,h*.5,z1+dz*t,.14,h,.14);}
  const horiz=Math.abs(dx)>Math.abs(dz);
  for(const y of [h*.78,h*.42])box(p,'#7d6340',x1+dx/2,y,z1+dz/2,horiz?len:.09,.1,horiz?.09:len);
}
function lampPost(p,x,z){const g=new T.Group();g.position.set(x,0,z);p.add(g);
  shape(g,'cylinder','#4d4034',[0,1.6,0],[.16,3.2,.16]);
  box(g,'#4d4034',.3,3.2,0,.66,.1,.1);
  box(g,'#2f2820',.56,2.92,0,.3,.42,.3);
  box(g,'#ffd9a0',.56,2.9,0,.2,.28,.2,true);}
function wellProp(p,x,z){const g=new T.Group();g.position.set(x,0,z);p.add(g);
  shape(g,'cylinder','#7c7364',[0,.55,0],[2.3,1.1,2.3]);
  shape(g,'cylinder','#2a3b40',[0,.99,0],[1.75,.1,1.75]);
  for(const s of [-1,1])box(g,'#6e5638',s*.86,1.4,0,.13,2.3,.13);
  box(g,'#6e5638',0,2.45,0,1.95,.13,.15);
  shape(g,'cone','#4a5b6e',[0,2.78,0],[2.3,1.2,2.3]);}
function cartProp(p,x,z,rot=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;p.add(g);
  box(g,'#7d6340',0,.72,0,1.7,.18,2.7);
  for(const s of [-1,1])box(g,'#6b5233',s*.86,.92,0,.1,.42,2.7);
  for(const zz of [-.7,.7]){
    const w1=shape(g,'cylinder','#4a3b2a',[-.98,.55,zz],[1.35,.12,1.35]);w1.rotation.z=Math.PI/2;
    const w2=shape(g,'cylinder','#4a3b2a',[.98,.55,zz],[1.35,.12,1.35]);w2.rotation.z=Math.PI/2;
  }
  for(const x2 of [-.45,.45])box(g,'#6e5638',x2,1.25,-1.5,.08,.8,.08);}
function wheatPatch(p,x,z,rows=4,cols=5){
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const bx=x+c*1.35, bz=z+r*1.35;
    box(p,'#c2a05c',bx,.34,bz,.95,.68,.95);
    box(p,'#8f7440',bx,.7,bz,.85,.06,.85);
  }
}
function forgeProp(p,x,z){const g=new T.Group();g.position.set(x,0,z);p.add(g);
  box(g,'#6b6a62',0,.42,0,2.4,.84,1.7);
  box(g,'#4d4034',0,.9,0,2.5,.12,1.8);
  shape(g,'ball','#b4552e',[0,1.02,0],[1.1,.24,1.1],true);
  shape(g,'cylinder','#585048',[1.35,1.6,0],[.5,3.2,.5]);
  shape(g,'cylinder','#4a4a44',[1.35,3.3,0],[.56,.5,.56]);
  box(g,'#3b3630',-1.25,.16,0,.7,.3,.7);}
function screen(p,x,y,z,w=1.05,h=.65){box(p,'#2b2822',x,y,z,w+.12,h+.12,.12);box(p,'#4a4640',x,y,z+.07,w,h,.025);for(let i=0;i<3;i++)box(p,'#c9d3c2',x-w*.1,y+h*.24-i*.14,z+.09,w*(.6-i*.1),.025,.015,true);}
function stallProp(p,x,z,color,rot=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;p.add(g);
  box(g,'#8a6a44',0,.86,0,2.5,.12,1.2);
  for(const sx of [-1.1,1.1])box(g,'#6b5233',sx,.43,0,.1,.86,1.15);
  for(const sx of [-1.1,1.1])box(g,'#6e5638',sx,1.35,-.55,.11,2.6,.11);
  const canopy=box(g,color,0,2.62,-.15,2.7,.09,1.9);canopy.rotation.x=-.2;
  for(const sx of [-1.35,1.35])box(g,'#6e5638',sx,1.35,-.55,.09,2.6,.09);
  for(let i=0;i<3;i++)shape(g,'ball',['#c9a86a','#8f7440','#b1904f'][i],[-.62+i*.62,1.0,0],[.36,.3,.36]);
  for(const sx of [-.95,.95])box(g,'#7d6340',sx,1.02,.1,.28,.28,.28);
}
function haystack(p,x,z,s=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);p.add(g);
  shape(g,'cylinder','#c9a86a',[0,.7,0],[2.2,1.4,2.2]);
  shape(g,'cone','#b1904f',[0,1.9,0],[2.5,1.4,2.5]);
  shape(g,'cylinder','#a0803f',[0,.25,0],[2.35,.2,2.35]);
}
function prop(root,p,color){const g=new T.Group();g.position.set(p.x,0,p.z);root.add(g);
  if(p.kind==='desk'){
    box(g,'#a9855a',0,.86,0,p.w,.12,p.d);
    box(g,'#8a6a44',0,.79,0,p.w-.1,.06,p.d-.1);
    for(const x of [-p.w*.38,p.w*.38])for(const z of [-p.d*.3,p.d*.3])box(g,'#6b5233',x,.42,z,.1,.84,.1);
    box(g,'#6b5233',0,.4,0,p.w-.34,.06,.08);
    box(g,'#c9c2ae',-.42,.96,.06,.62,.04,.34);
    shape(g,'cylinder','#3c5a4a',[.52,1.02,-.18],[.2,.32,.2]);
    shape(g,'cylinder','#b8a06a',[.06,1.0,-.28],[.15,.22,.15]);
    box(g,'#7a6a52',-.28,.99,-.26,.28,.11,.11);
    const ham=box(g,'#5a5348',.66,1.06,.22,.09,.44,.09);ham.rotation.z=.5;
    box(g,'#3a3630',.66,1.26,.22,.2,.07,.07);
  }else if(p.kind==='chair'){
    box(g,'#8a6a44',0,.52,0,.62,.1,.62);
    for(const x of [-.22,.22])for(const z of [-.22,.22])box(g,'#6b5233',x,.26,z,.07,.52,.07);
    box(g,'#6b5233',0,.28,0,.5,.05,.05);
  }else if(p.kind==='plant')plant(g,0,0);
  else if(p.kind==='rug'){
    box(g,color,0,.02,0,p.w,.03,p.d);
    for(let i=-1;i<=1;i++)box(g,'#c9b48a',0,.032,i*p.d*.32,p.w-.25,.012,.07);
  }else if(p.kind==='beanbag'){
    box(g,'#c9a86a',0,.42,0,1.5,.84,1.05);
    box(g,'#b1904f',0,.86,0,1.52,.06,1.07);
    for(const x of [-.45,.45])box(g,'#7a6a52',x,.44,0,.08,.86,1.08);
  }else if(p.kind==='water'){
    barrel(g,0,0,1.05);
    shape(g,'cylinder','#8d7b5c',[0,1.02,0],[.3,.22,.3]);
    box(g,'#b8b3a4',.62,.08,0,.26,.16,.26);
  }else if(p.kind==='arcade'){
    box(g,'#6b5233',0,1.15,0,1.2,1.95,.12);
    for(let i=0;i<3;i++)box(g,'#8a7048',0,.72+i*.52,0,1.1,.05,.07);
    const saw=box(g,'#b8b3a4',-.34,1.32,.1,.08,.62,.02);saw.rotation.z=.12;
    box(g,'#5a5348',.28,1.36,.12,.07,.46,.07);
    box(g,'#7f8b8c',.28,1.1,.12,.2,.06,.18);
    box(g,'#4d4034',0,.28,0,1.25,.12,.55);
    shape(g,'cylinder','#3c4a3a',[-.35,.42,.06],[.24,.28,.24]);
  }else if(p.kind==='coffee'){
    box(g,'#6b6a62',0,.16,0,.95,.32,.95);
    shape(g,'ball','#333d36',[0,.6,0],[.62,.5,.62]);
    shape(g,'ball','#aeffe0',[0,.8,0],[.3,.13,.3],true);
    box(g,'#4d4034',0,.04,0,1.15,.08,1.15);
  }else if(p.kind==='shelf'){
    box(g,'#6b5233',0,1.1,0,p.w,2.2,p.d);
    for(let lvl=0;lvl<2;lvl++){
      box(g,'#8a7048',0,.5+lvl*.85,.34,p.w-.1,.08,.5);
      for(let i=0;i<5;i++)shape(g,'cylinder',['#a7bbad','#be9f8b','#c9a86a'][i%3],[-.95+i*.48,.72+lvl*.85,.34],[.24,.32,.24]);
    }
  }else if(p.kind==='feature'){
    if(p.theme==='laboratory'){
      box(g,'#8a6a44',0,.84,0,2.3,.12,1);
      for(const x of [-1,.95])box(g,'#6b5233',x,.42,0,.1,.84,.85);
      shape(g,'ball','#3a4a40',[-.4,1.02,0],[.5,.4,.5]);
      for(let i=0;i<4;i++)shape(g,'cylinder',i%2?'#aeffe0':'#82c9d6',[.35+i*.22,1.05,-.1],[.12,.28,.12],true);
      shape(g,'cylinder','#5a5348',[.75,1.02,.22],[.16,.3,.16]);
    }else if(p.theme==='observatory'){
      for(let i=0;i<3;i++){const a=i*2.094;box(g,'#6b5233',Math.cos(a)*.42,.62,Math.sin(a)*.42,.08,1.25,.08);}
      const tube=shape(g,'cylinder','#8a7048',[0,1.45,0],[.26,1.5,.26]);tube.rotation.z=.62;
      shape(g,'ball','#8bbed0',[.44,1.85,0],[.3,.3,.3],true);
      box(g,'#c9b48a',-.8,.03,0,.9,.05,.6);
    }else if(p.theme==='control'){
      box(g,'#8a6a44',0,.84,0,2.4,.12,1.1);
      box(g,'#d8d2bd',0,.93,0,1.1,.03,.8);
      for(let i=0;i<3;i++)box(g,'#7f8b8c',-.35+i*.35,.95,-.1+i*.12,.3,.01,.03,true);
      for(const x of [-1,.98])box(g,'#6b5233',x,.42,0,.1,.84,.95);
      box(g,'#2b2822',0,1.55,-.62,1.9,1.1,.08);
      for(let i=0;i<3;i++)box(g,'#c9d3c2',0,1.8-i*.3,-.57,1.4,.03,.02,true);
    }else{
      box(g,'#a9855a',0,.82,0,2.2,.12,1);
      for(const x of [-.95,.92])box(g,'#6b5233',x,.41,0,.1,.82,.85);
      box(g,'#8a6a44',-.3,1.0,0,.9,.24,.7);
      box(g,'#6b5233',.55,1.02,.1,.5,.4,.5);
      box(g,'#c9c2ae',-.9,.98,-.2,.4,.02,.3);
      shape(g,'cylinder','#3c5a4a',[.9,1.15,0],[.2,.3,.2]);
    }
  }
}

function batch(root){
  const groups=new Map();root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});
  const out=new T.Group();for(const list of groups.values()){const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((m,i)=>mesh.setMatrixAt(i,m.matrixWorld));mesh.computeBoundingSphere();out.add(mesh);}return out;
}
export function buildEnvironment(layout){
  const root=new T.Group();

  // --- tanah padang rumput, produksi house berdiri di atasnya (bukan mengambang) ---
  const ground=new T.Mesh(new T.PlaneGeometry(420,420),new T.MeshStandardMaterial({map:texture('grass'),roughness:1,metalness:0}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.09;root.add(ground);
  // bukit melingkar supaya cakrawala tidak kosong
  for(let i=0;i<14;i++){
    const ang=i/14*6.2832, r=150+Math.random()*40;
    shape(root,'ball',i%3?'#3f5e40':'#35503a',[Math.cos(ang)*r,-2,Math.sin(ang)*r],[60+Math.random()*40,16+Math.random()*14,50+Math.random()*30]);
  }

  // halaman berbatu + jalan setapak kayu
  surf(root,'stone',0,-.04,0,40,.12,32,'#a9a08e');
  surf(root,'wood',0,.02,0,4.6,.06,32,'#8f7a56');
  surf(root,'wood',0,.025,0,40,.06,4.6,'#8f7a56');
  for(const [x,z,w,d] of [[0,-16.4,42,1.8],[0,16.4,42,1.8],[-20.4,0,1.8,34],[20.4,0,1.8,34]])
    surf(root,'grass',x,-.03,z,w,.08,d,'#7d9767');

  // --- pondasi batu + lantai tiap bay kerja ---
  for(const team of layout.teams){
    const [x,z]=team.center;
    box(root,'#8b8272',x,.02,z,16.2,.14,12.2);
    box(root,team.color,x,.09,z-5.9,15.9,.03,.12);
  }

  // --- bilik kerja: rangka kayu + dinding anyaman, bukan sekat kantor ---
  for(const w of layout.walls){
    const horiz=w.w>=w.d, len=horiz?w.w:w.d, th=horiz?w.d:w.w;
    box(root,'#c3b393',w.x,w.h*.3,w.z,horiz?w.w:.17,w.h*.6,horiz?.17:w.d);
    for(const s of [-.5,.5])
      box(root,'#6e5638',w.x+(horiz?s*len:0),w.h*.5,w.z+(horiz?0:s*len),horiz?.19:th,w.h,horiz?th:.19);
    box(root,'#7d6340',w.x,w.h,w.z,horiz?w.w+.22:th+.08,.15,horiz?th+.08:w.d+.22);
    box(root,'#8f7440',w.x,w.h*.62,w.z,horiz?w.w-.1:.06,horiz?.07:w.h*.5,horiz?.06:w.d-.1);
  }

  for(const p of layout.props)prop(root,p,layout.teams.find(t=>t.id===p.team).color);

  // --- pagar kayu keliling halaman, gerbang di depan ---
  fenceRun(root,-20.5,-16,20.5,-16);
  fenceRun(root,-20.5,16,-4.4,16);
  fenceRun(root,4.4,16,20.5,16);
  fenceRun(root,-20.5,-16,-20.5,16);
  fenceRun(root,20.5,-16,20.5,16);
  for(const x of [-4.4,4.4])box(root,'#6e5638',x,1.5,16,.28,3,.28);
  box(root,'#7d6340',0,3.05,16,9.2,.22,.24);
  // daun gerbang
  for(const s of [-1,1]){
    box(root,'#8a6a44',s*2.05,1.15,15.95,3.9,2.3,.12);
    for(const y of [.55,1.15,1.75])box(root,'#4a3b2a',s*2.05,y,15.88,3.9,.1,.06);
  }

  // --- tembok batu belakang (keep) + krenelasi + panji tim ---
  box(root,'#6e614f',0,1.5,-16.6,42,3,.6);
  box(root,'#585048',0,3.08,-16.6,42.2,.18,.7);
  for(let x=-20.4;x<=20.4;x+=1.55)box(root,'#585048',x,3.36,-16.6,.7,.4,.64);
  const banners=[[-13,0],[13,1],[-6,2],[6,3]];
  for(const [bx,ti] of banners){
    const team=layout.teams[ti]; if(!team) continue;
    box(root,'#8f7c5c',bx,1.8,-16.1,.1,3.4,.1);
    box(root,'#c9a86a',bx+.7,3.1,-16.05,1.4,.1,.1);
    box(root,team.color,bx+.7,2.3,-16.05,1.32,1.6,.06);
    shape(root,'ball','#fff4d6',[bx+.7,2.3,-15.98],[.3,.3,.06]);
    shape(root,'cone',team.color,[bx,3.7,-16.1],[.5,.55,.5]);
  }
  for(const tx of [-14,14]){
    shape(root,'cylinder','#4d4034',[tx,1.3,-16.1],[.18,2.6,.18]);
    shape(root,'ball','#ffd9a0',[tx,2.7,-16.1],[.34,.42,.34],true);
  }

  // --- pusat halaman: grimoire ditempatkan di buildBrain(), di sini batu landasnya ---
  shape(root,'cylinder','#7c7364',[0,.16,0],[3.9,.34,3.9]);
  shape(root,'cylinder','#8f8776',[0,.36,0],[3.3,.1,3.3]);

  // --- fasilitas produksi di sekitar halaman ---
  for(const [sx,sz,col,rot] of [[-12,18.4,'#9d3b3b',0],[12.6,18.2,'#3f6a7a',0],[-19.5,-11,'#6b5a3a',Math.PI]])stallProp(root,sx,sz,col,rot);
  for(const [hx,hz,hs] of [[-22,17,1.1],[23,17.6,1],[20.5,-13.5,1.2]])haystack(root,hx,hz,hs);
  wellProp(root,14.5,19.5);
  forgeProp(root,-14.5,19.6);
  cartProp(root,25,7,-.5);
  cartProp(root,-26,-9,1.1);
  for(const [x,z,s,r] of [[23,-6,1,.3],[24.6,-6.8,.85,-.5],[23.2,-8,1.15,.7],[25.5,-4.6,.8,.2]])crate(root,x,0,z,s,r);
  for(const [x,z,s] of [[-24,4,1],[-25.4,5.2,.85],[-23.2,5.6,.95]])crate(root,x,0,z,s,Math.PI*.18);
  for(const [x,z,r] of [[21.4,12,.4],[22.6,13.4,-.2],[-21.6,11.6,.8]])barrel(root,x,z,1,r);
  for(const [x,z,s] of [[25,17,1.2],[-26,15,1.1]])barrel(root,x,z,s,.3);
  wheatPatch(root,-31,20,3,4);
  wheatPatch(root,-31,25,2,4);
  wheatPatch(root,26,22,3,4);
  // tumpukan kayu & rak jemur
  for(let i=0;i<5;i++)shape(root,'cylinder','#7a5a38',[-25.5,.32+i*.16,-13+i*.05],[.34,2.6,.34]).rotation.z=Math.PI/2;
  for(const sx of [17,19]){
    box(root,'#6e5638',sx,1.1,-19,.12,2.2,.12);
    box(root,'#6e5638',sx+2.2,1.1,-19,.12,2.2,.12);
    box(root,'#7d6340',sx+1.1,2.1,-19,2.5,.1,.1);
    box(root,'#c9b48a',sx+1.1,1.55,-19,2.2,.9,.06);
  }

  // --- penerangan jalan & pohon ---
  for(const [x,z] of [[-8,18],[8,18],[-19,8],[19,8],[-19,-9],[19,-9]])lampPost(root,x,z);
  for(const [x,z,s] of [[-27,22,1.15],[-33,16,1],[-30,-20,1.2],[30,-19,1.1],[33,15,1],[26,27,1.25],[-36,-6,1.1],[36,-4,1.15]])
    tree(root,x,z,s);
  for(const [x,z] of [[-18,14],[-19.5,-4],[18.5,14],[19.5,-4],[3.5,14.6],[-3.5,14.6]])plant(root,x,z,.9);

  // --- menara kastil di kejauhan, berdiri di tanah ---
  for(const [tx,tz,r] of [[-40,-46,1.15],[40,-46,1.15],[0,-58,1]]){
    shape(root,'cylinder','#6e614f',[tx,15*r,tz],[7*r,30*r,7*r]);
    shape(root,'cylinder','#585048',[tx,30.4*r,tz],[7.6*r,.7*r,7.6*r]);
    shape(root,'cone','#4a5b6e',[tx,35.6*r,tz],[15*r,10.6*r,15*r]);
    box(root,'#8f7c5c',tx,42*r,tz,.18,3.8*r,.18);
    box(root,'#9e3b3b',tx+.62,43.6*r,tz,1.3,.8,.06);
  }
  // --- keep + tirai benteng supaya menara menyatu jadi kastil ---
  box(root,'#6e614f',0,11,-58,20,22,15);
  box(root,'#585048',0,22.6,-58,21.4,.8,16.4);
  for(let i=-2;i<=2;i++){box(root,'#585048',i*4.2,23.6,-65.4,1.6,1.6,1.2);box(root,'#585048',i*4.2,23.6,-50.6,1.6,1.6,1.2);}
  for(const wx of [-14.5,0,14.5])box(root,'#3a4048',wx,14,-58,2.4,3.6,.4);
  for(const wx of [-30,-10,10,30])box(root,'#6e614f',wx,4.2,-46,17.4,8.4,1.8);
  for(const wx of [-30,-10,10,30])box(root,'#585048',wx,8.9,-46,17.6,.9,2.2);
  for(const gx of [-6.4,6.4])box(root,'#6e614f',gx,5.6,-46,2.4,11.2,2.4);
  box(root,'#585048',0,11.8,-46,15,1.4,3);
  return batch(root);
}

export function buildBrain(){
  // Clover Kingdom: the shared brain is a stone grimoire tower.
  const g=new T.Group();
  shape(g,"cylinder","#6e614f",[0,1.1,0],[3.4,2.2,3.4]);
  shape(g,"cylinder","#585048",[0,2.22,0],[3.7,.16,3.7]);
  shape(g,"cylinder","#84765f",[0,3.0,0],[2.5,1.5,2.5]);
  shape(g,"cylinder","#585048",[0,3.78,0],[2.8,.14,2.8]);
  for(let i=0;i<6;i++){const a=i*Math.PI/3+.35;box(g,"#585048",Math.cos(a)*2.35,4.02,Math.sin(a)*2.35,.4,.36,.4);}
  const book=new T.Group();book.position.set(0,4.55,0);g.add(book);
  const pl=box(book,"#aeffe0",-.36,0,0,.72,.05,.92,true);pl.rotation.z=.4;
  const pr=box(book,"#aeffe0",.36,0,0,.72,.05,.92,true);pr.rotation.z=-.4;
  box(book,"#2f3a33",0,-.04,0,.14,.1,.98);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;shape(g,"ball","#aeffe0",[Math.cos(a)*.3,5.2,Math.sin(a)*.3],[.52,.16,.52],true);}
  shape(g,"ball","#e8fff6",[0,5.1,0],[.24,.24,.24],true);
  shape(g,"ball","#aeffe0",[0,4.55,0],[.5,.5,.5],true);
  return g;
}
// Outfit per reference character: shirt/pants/boots/gloves plus the gear that still reads at office scale.
const OUTFITS={
  deku:{shirt:'#3f8f6b',pants:'#356f56',boots:'#b5482f',gloves:'#f2f1e6',belt:'#d8c57a',gear:['cuffs','freckles','kneepads','hood']},
  choso:{shirt:'#2b2734',pants:'#211d29',boots:'#2f2b38',gloves:'#2b2734',belt:'#efe9da',gear:['obi','widesleeve','innercollar','facestripe','sidelock']},
  levi:{coat:'#8b7a5c',shirt:'#f1eee2',pants:'#e9e4d7',boots:'#22282e',gloves:'#e9e4d7',belt:'#2b3137',gear:['cravat','jacket','straps','thighbox','undercut']},
  archer:{coat:'#8f2f33',shirt:'#2a2f38',pants:'#252a33',boots:'#1d222a',gloves:'#333c4b',belt:'#7d2f31',gear:['mantle','highcollar','cross','tailcoat']},
  eren:{coat:'#8b7a5c',shirt:'#efe9dc',pants:'#e9e3d4',boots:'#4a3a2a',gloves:'#efe9dc',belt:'#39402f',gear:['jacket','straps','thighbox','cloakemblem']},
  shinei:{shirt:'#2f3b4d',pants:'#26303f',boots:'#1b222b',gloves:'#2f3b4d',belt:'#141920',gear:['armband','dogtag','tallcollar']},
  saber:{shirt:'#2f4f9a',pants:'#28407e',boots:'#cdd1da',gloves:'#cdd1da',belt:'#c9a86a',gear:['plate','pauldrons','gauntlets','goldtrim']},
  lancer:{shirt:'#365d97',pants:'#2d4c7d',boots:'#22262e',gloves:'#dedbe3',belt:'#9b2f36',gear:['shoulderguard','spear','cheststrap']}
};
export function buildAvatar(skinId,cloakColor='#3a4750'){
  const skin=SKINS[skinId]||SKINS.levi,o=OUTFITS[skinId]||OUTFITS.levi,gear=new Set(o.gear||[]),coat=o.coat||skin.coat;
  const has=t=>gear.has(t),g=new T.Group(),hips=new T.Group();g.add(hips);hips.position.y=.95;
  // Reference outfit: shirt panel, belt, then the character's own layers on top.
  box(hips,o.shirt,0,.26,0,.46,.57,.3);box(hips,o.shirt,0,.25,.155,.2,.43,.02);box(hips,o.belt,0,-.02,0,.47,.07,.32);
  if(has('plate')){box(hips,'#b9c0cb',0,.29,.15,.4,.42,.09);box(hips,'#8b93a1',0,.29,.2,.24,.3,.03);box(hips,'#c9a86a',0,.07,.15,.42,.05,.05);}
  if(has('obi'))box(hips,'#efe9da',0,-.02,0,.5,.13,.34);
  if(has('jacket')){
    box(hips,coat,0,.42,0,.5,.23,.33);
    for(const s of[-1,1]){box(hips,coat,s*.2,.28,.13,.11,.3,.15);box(hips,'#d9c9a4',s*.07,.45,.17,.045,.2,.02);}
  }
  if(has('mantle')){box(hips,coat,0,.5,-.02,.54,.17,.37);for(const s of[-1,1]){const m=shape(hips,'box',coat,[s*.25,.35,-.03],[.19,.44,.1]);m.rotation.z=s*.13;}}
  if(has('tailcoat'))for(const s of[-1,1]){const t=shape(hips,'box',coat,[s*.12,-.26,-.16],[.22,.52,.07]);t.rotation.x=.1;}
  if(has('cravat')){box(hips,'#f5f2e6',0,.49,.07,.13,.12,.17);box(hips,'#f5f2e6',0,.45,.13,.21,.17,.05);}
  if(has('highcollar'))box(hips,'#1d2129',0,.55,.02,.3,.1,.26);
  if(has('tallcollar'))box(hips,'#1c2430',0,.56,.02,.34,.11,.28);
  if(has('hood'))box(hips,skin.accent,0,.54,-.05,.36,.1,.28);
  if(has('innercollar'))box(hips,'#f0ebdd',0,.5,.13,.22,.13,.04);
  if(has('armband'))box(hips,'#9b2f36',-.27,.31,0,.09,.09,.29);
  if(has('dogtag'))box(hips,'#c8ccd2',0,.36,.16,.09,.07,.02);
  if(has('cross')){box(hips,'#c9ced6',0,.4,.16,.03,.14,.02);box(hips,'#c9ced6',0,.43,.16,.1,.03,.02);}
  // Survey Corps keep the wings-of-freedom cloak; everyone else shows the outfit itself.
  if(has('cloakemblem')){
    const cloak=box(hips,'#3d5c46',0,.2,-.2,.52,.66,.06);cloak.rotation.x=-.06;
    for(const s of[-1,1]){const w=shape(hips,'box','#e6e2cf',[s*.07,.26,-.235],[.1,.05,.02]);w.rotation.z=s*.5;}
    box(hips,'#c9a86a',0,.5,-.18,.52,.06,.05);
  }
  const head=new T.Group();head.position.y=.79;hips.add(head);shape(head,'ball','#ddbc9e',[0,0,0],[.47,.52,.43]);
  shape(head,'ball',skin.hair,[0,.17,-.025],[.51,.32,.46]);
  for(const x of[-.11,.11])box(head,'#26333e',x,-.015,.205,.045,.045,.025);
  // Small nose + mouth hint keeps faces readable at office scale without uncanny detail.
  box(head,'#d3ab8b',0,-.09,.215,.05,.06,.03);box(head,'#b98a72',0,-.165,.208,.09,.02,.02);
  if(has('freckles'))for(const x of[-.15,-.06,.06,.15])box(head,'#a9806b',x,-.06,.198,.022,.022,.01);
  if(has('facestripe'))box(head,'#171320',0,-.05,.207,.19,.045,.012);
  if(has('sidelock')){const l=shape(head,'box',skin.hair,[-.21,-.14,.06],[.09,.4,.12]);l.rotation.z=.16;}
  if(has('undercut'))box(head,skin.hair,0,.14,-.19,.5,.26,.18);
  if(skin.style==='spike')for(let i=0;i<5;i++){const m=shape(head,'cone',skin.hair,[(i-2)*.095,.33,-.02],[.18,.25+(i%2)*.1,.22]);m.rotation.z=(2-i)*.18;}
  if(skin.style==='bun'||skin.style==='tail')shape(head,'ball',skin.hair,[0,.18,-.27],[.27,skin.style==='tail'?.6:.25,.27]);
  if(skin.style==='twobuns')for(const x of[-.24,.24])shape(head,'ball',skin.hair,[x,.24,0],[.24,.25,.24]);
  if(skin.style==='fringe')box(head,skin.hair,-.09,.08,.18,.22,.18,.1);
  const arms=[],legs=[];
  for(const side of[-1,1]){
    const arm=new T.Group();arm.position.set(side*.3,.47,0);hips.add(arm);
    const sleeve=has('jacket')?coat:o.shirt;
    shape(arm,'ball',sleeve,[0,.02,0],[.2,.18,.22]);
    box(arm,sleeve,0,-.17,0,.15,.34,.17);
    if(has('pauldrons'))shape(arm,'ball','#c9ced6',[side*.03,.05,0],[.24,.16,.24]);
    if(has('shoulderguard')&&side>0)box(arm,'#b9c0cb',.03,.04,0,.16,.14,.2);
    if(has('widesleeve'))box(arm,o.shirt,0,-.24,0,.21,.26,.2);
    if(has('straps')){const st=shape(arm,'box','#3a2f26',[0,-.12,.085],[.05,.38,.02]);st.rotation.z=side*.12;}
    const fore=new T.Group();fore.position.y=-.32;arm.add(fore);
    box(fore,has('gauntlets')?'#b9c0cb':sleeve,0,-.14,0,.13,.28,.14);
    if(has('gauntlets'))box(fore,'#8b93a1',0,-.24,0,.15,.08,.16);
    if(has('cuffs'))box(fore,o.gloves,0,-.19,0,.16,.1,.17);
    shape(fore,'ball',o.gloves,[0,-.3,0],[.15,.17,.16]);arms.push({arm,fore});
    const thigh=new T.Group();thigh.position.set(side*.14,-.05,0);hips.add(thigh);box(thigh,o.pants,0,-.22,0,.19,.44,.2);
    if(has('thighbox'))box(thigh,'#3a2f26',side*.09,-.2,.03,.1,.16,.18);
    const shin=new T.Group();shin.position.y=-.43;thigh.add(shin);
    box(shin,o.pants,0,-.275,0,.17,.55,.18);
    if(has('kneepads'))box(shin,'#2c5a49',0,-.03,.02,.19,.16,.21);
    box(shin,o.boots,0,-.46,.08,.23,.16,.36);legs.push({thigh,shin});
  }
  if(has('spear')){const s=new T.Group();s.position.set(.3,.1,-.24);s.rotation.set(.16,0,-.34);hips.add(s);
    shape(s,'cylinder','#7b2f2c',[0,0,0],[.05,1.95,.05]);shape(s,'cone','#c9ced6',[0,1.03,0],[.1,.32,.1]);box(s,'#3a3f46',0,-.72,0,.06,.32,.06);}
  if(has('cheststrap'))box(hips,'#5a4a3a',0,.3,.16,.36,.05,.015);
  const cup=shape(arms[1].fore,'cylinder','#e8dfbc',[0,-.3,.07],[.13,.2,.13]);cup.visible=false;
  return {root:g,hips,head,arms,legs,cup};
}
export function poseAvatar(rig,a,time,reduced=false){
  const seated=a.mode==='typing'||a.mode==='lounge',walk=a.mode==='walk',t=reduced?0:time;
  const phase=a.phase||0;
  rig.root.position.set(a.p[0],0,a.p[1]);rig.root.rotation.y=a.yaw;
  // Natural weight shift: subtle hip sway when walking, breathing bob when idle/seated.
  const breathe=reduced?0:Math.sin(t*1.7+phase)*.012;
  rig.hips.position.y=(seated?.65:1.11)+(walk?Math.abs(Math.sin(t*8+phase))*.035:breathe);
  rig.hips.rotation.x=seated?.04:0;
  rig.hips.rotation.z=walk&&!reduced?Math.sin(t*8+phase)*.035:0;
  // Head: look around when idle, nod slightly while typing, turn toward partner in chat.
  if(reduced)rig.head.rotation.set(0,0,0);
  else if(a.mode==='chat')rig.head.rotation.set(Math.sin(t*1.3+phase)*.05,Math.sin(t+phase)*.14,0);
  else if(a.mode==='typing')rig.head.rotation.set(.14+Math.sin(t*2.1+phase)*.035,Math.sin(t*.6+phase)*.08,0);
  else if(walk)rig.head.rotation.set(0,0,0);
  else rig.head.rotation.set(Math.sin(t*.9+phase)*.04,Math.sin(t*.4+phase)*.22,0);
  rig.legs.forEach(({thigh,shin},i)=>{
    const gait=t*8+phase+i*Math.PI;
    thigh.rotation.x=seated?-Math.PI/2:walk?Math.sin(gait)*.5:0;
    shin.rotation.x=seated?Math.PI/2-.12:walk?Math.max(0,Math.sin(gait-.6))*.75:0;
  });
  rig.arms.forEach(({arm,fore},i)=>{
    arm.rotation.set(0,0,0);fore.rotation.x=0;
    if(a.mode==='typing'){
      // Alternating keystrokes: each hand taps on its own rhythm, wrists relaxed.
      arm.rotation.x=-1.02+Math.sin(t*11+phase+i*2.4)*.045;
      fore.rotation.x=-.55+Math.max(0,Math.sin(t*13+phase+i*Math.PI))*.14;
      arm.rotation.z=(i?1:-1)*.1;
    }
    else if(a.mode==='arcade'){arm.rotation.x=-1;fore.rotation.x=-.4+Math.sin(t*9+i+phase)*.12;}
    else if(a.mode==='drink'&&i===1){arm.rotation.x=-1.65-Math.sin(t*1.1+phase)*.18;fore.rotation.x=-.7;}
    else if(a.mode==='drink'){arm.rotation.x=.06;}
    else if(a.mode==='chat'){
      // Gesturing: one hand emphasizes while the other rests.
      const gest=i===0?Math.sin(t*2.2+phase)*.22:Math.sin(t*1.4+phase)*.08;
      arm.rotation.x=-.35-gest*.4;arm.rotation.z=(i?1:-1)*(.18+gest*.5);fore.rotation.x=-.55-gest*.3;
    }
    else if(a.mode==='lounge'){arm.rotation.x=-.25;arm.rotation.z=(i?1:-1)*.35;fore.rotation.x=-.3;}
    else if(walk){arm.rotation.x=Math.sin(t*8+phase+i*Math.PI)*-.38;fore.rotation.x=-.22;}
    else{arm.rotation.x=.04+Math.sin(t*1.7+phase+i)*.02;arm.rotation.z=(i?1:-1)*.06;}
  });rig.cup.visible=a.mode==='drink';
}
export function disposeShared(){for(const g of Object.values(geo))g.dispose();for(const m of mats.values())m.dispose();mats.clear();}
