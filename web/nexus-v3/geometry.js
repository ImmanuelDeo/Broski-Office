import * as T from './vendor/three.module.js';
import {SKINS} from './roster.js';
const geo={box:new T.BoxGeometry(1,1,1),ball:new T.IcosahedronGeometry(.5,1),cylinder:new T.CylinderGeometry(.5,.5,1,10),cone:new T.ConeGeometry(.5,1,5)};
const mats=new Map();
export function material(color,glow=false){const k=color+glow;if(!mats.has(k))mats.set(k,new T.MeshStandardMaterial({color,roughness:.84,metalness:.08,flatShading:true,...(glow?{emissive:color,emissiveIntensity:.7}:{})}));return mats.get(k);}
export function shape(parent,type,color,pos,scale,glow=false){const m=new T.Mesh(geo[type],material(color,glow));m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
const box=(p,c,x,y,z,w,h,d,g=false)=>shape(p,'box',c,[x,y,z],[w,h,d],g);
function plant(p,x,z,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);p.add(g);shape(g,'cylinder','#dedac4',[0,.27,0],[.48,.55,.48]);box(g,'#645943',0,.9,0,.08,1.1,.08);for(let i=0;i<4;i++)shape(g,'ball',i%2?'#57886d':'#395e50',[Math.sin(i*2)*.22,1.1+i*.15,Math.cos(i*2)*.22],[.7,.9,.65]);}
function screen(p,x,y,z,w=1.05,h=.65){box(p,'#111e29',x,y,z,w+.12,h+.12,.12);box(p,'#80b4b2',x,y,z+.07,w,h,.025,true);for(let i=0;i<3;i++)box(p,'#d1eee1',x-w*.1,y+h*.24-i*.14,z+.09,w*(.6-i*.1),.025,.015,true);}
function prop(root,p,color){const g=new T.Group();g.position.set(p.x,0,p.z);root.add(g);
  if(p.kind==='desk'){
    box(g,'#b9ad95',0,.84,0,p.w,.14,p.d);for(const x of [-1.05,1.05])box(g,'#34464a',x,.4,0,.1,.8,.8);
    screen(g,-.5,1.35,-.2,.95,.56);screen(g,.55,1.35,-.2,.8,.56);box(g,'#182c35',0,.95,.5,.82,.065,.24);box(g,'#d0c8b2',1,1,.35,.15,.25,.15);
  }else if(p.kind==='chair'){
    box(g,'#364c54',0,.57,0,.68,.16,.68);box(g,'#48626a',0,1.03,.32,.68,.85,.1);shape(g,'cylinder','#24333d',[0,.28,0],[.12,.5,.12]);box(g,'#24333d',0,.08,0,.72,.06,.58);
  }else if(p.kind==='plant')plant(g,0,0);
  else if(p.kind==='rug')box(g,color,0,.018,0,p.w,.025,p.d);
  else if(p.kind==='beanbag'){shape(g,'ball',color,[0,.38,0],[1.6,.8,1.5]);shape(g,'ball',color,[0,.63,.38],[1.3,.9,.9]);}
  else if(p.kind==='water'){box(g,'#d3ded7',0,.55,0,.65,1.1,.6);shape(g,'cylinder','#8db8cd',[0,1.35,0],[.44,.55,.44]);box(g,'#223c49',0,.75,.31,.32,.3,.04);for(let x of [-.09,.09])box(g,x<0?'#d2857a':'#82afca',x,.9,.36,.07,.06,.09);}
  else if(p.kind==='arcade'){box(g,'#283640',0,.8,0,1.05,1.6,.8);box(g,color,0,1.8,0,1.12,.23,.85);screen(g,0,1.3,.42,.8,.5);box(g,color,0,.93,.53,1,.13,.4);shape(g,'ball','#ed9f93',[-.24,1.06,.55],[.12,.12,.12]);shape(g,'ball','#eed592',[.25,1.03,.55],[.12,.07,.12]);}
  else if(p.kind==='coffee'){shape(g,'cylinder','#af9d7d',[0,.4,0],[.8,.12,.8]);shape(g,'cylinder','#354348',[0,.2,0],[.15,.4,.15]);shape(g,'cylinder','#e6e0c8',[0,.55,0],[.2,.2,.2]);}
  else if(p.kind==='shelf'){
    box(g,'#33454b',0,1.1,0,p.w,2.2,p.d);for(let level=0;level<3;level++){
      box(g,'#a59172',0,.28+level*.65,.34,p.w,.08,.5);
      for(let i=0;i<9;i++)box(g,['#a7bbad','#be9f8b',color][i%3],-1.25+i*.3,.57+level*.65,.34,.18,.38+(i%2)*.1,.28);
    }
  }else if(p.kind==='feature'){
    if(p.theme==='laboratory'){
      box(g,'#202e3c',0,1,0,1.2,2,1);for(let i=0;i<6;i++){box(g,'#4a6770',0,.25+i*.28,.53,.98,.16,.05);box(g,'#a4e3c1',.32,.25+i*.28,.57,.06,.04,.03,true);}shape(g,'ball',color,[1,.45,0],[.6,.7,.5]);
    }else if(p.theme==='observatory'){
      shape(g,'ball','#8bbed0',[0,1.17,0],[1,1,1]);shape(g,'cylinder','#bda77a',[0,.5,0],[.15,1,.15]);box(g,'#bda77a',0,.06,0,1,.1,.7);
      for(let i=0;i<4;i++)box(g,'#d9cbae',1,.1+i*.09,0,.65,.08,.5);
    }else if(p.theme==='control'){
      screen(g,0,1.5,0,2.2,1.1);for(let x of [-.8,.8])box(g,'#465b61',x,.65,0,.1,1.3,.1);
    }else{
      box(g,'#b7a583',0,.75,0,2.3,.12,1);for(let i=0;i<5;i++)box(g,i%2?color:'#daceab',-.6,.87+i*.08,0,.8,.07,.55);shape(g,'ball','#c7ba85',[.7,1.05,0],[.3,.45,.3]);
    }
  }
}
function batch(root){
  const groups=new Map();root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+o.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);});
  const out=new T.Group();for(const list of groups.values()){const mesh=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((m,i)=>mesh.setMatrixAt(i,m.matrixWorld));mesh.computeBoundingSphere();out.add(mesh);}return out;
}
export function buildEnvironment(layout){
  const root=new T.Group();
  box(root,'#1b303b',0,-.45,0,40,.9,32);box(root,'#31494a',0,-.03,0,39,.08,31);
  box(root,'#b3a184',0,.015,0,4,.035,30);box(root,'#b3a184',0,.02,0,38,.035,4);
  for(let z=-14.5;z<15;z+=.55)box(root,'#8c826c',0,.04,z,3.9,.015,.025);
  for(const team of layout.teams){const [x,z]=team.center;box(root,'#263d43',x,.05,z,15.8,.08,11.8);box(root,team.color,x,.1,z-5.7,15.5,.035,.06);}
  for(const w of layout.walls){box(root,'#354c51',w.x,w.h/2,w.z,w.w,w.h,w.d);box(root,'#b5b39a',w.x,w.h+.025,w.z,w.w,.05,w.d+.03);}
  for(const p of layout.props)prop(root,p,layout.teams.find(t=>t.id===p.team).color);
  for(const x of [-19.4,19.4])for(let z=-15;z<=15;z+=3){box(root,'#89adb0',x,1.3,z,.05,2.6,.05);}
  for(const x of [-19.4,19.4])box(root,'#89adb0',x,2.6,0,.05,.05,30);
  for(let x=-18;x<=18;x+=3){box(root,'#96bbbc',x,2.4,-15.4,.05,4.8,.05);plant(root,x,15,.6);}
  box(root,'#96bbbc',0,4.8,-15.4,39,.06,.06);
  // Visible tower facade extends below the penthouse.
  box(root,'#172b39',0,-3.3,0,38,5,30);
  for(let x=-18;x<=18;x+=1.5)box(root,'#668a95',x,-3.4,15.04,.035,4.8,.04);
  for(let y=-5.5;y<-.6;y+=1.1)box(root,'#668a95',0,y,15.05,38,.035,.05);
  shape(root,'cylinder','#294d52',[0,.25,0],[3.2,.5,3.2]);shape(root,'cylinder','#82d2c5',[0,.52,0],[2.8,.08,2.8],true);
  return batch(root);
}
export function buildBrain(){const g=new T.Group();for(let side of [-1,1])for(let i=0;i<7;i++){const angle=i*.91;shape(g,'ball',i%2?'#b4a6cb':'#c9bbd9',[side*(.3+Math.sin(angle)*.18),1.9+Math.cos(angle)*.4,Math.sin(angle)*.48],[.7,.7,.75]);}return g;}
export function buildAvatar(skinId){
  const skin=SKINS[skinId]||SKINS.levi,g=new T.Group(),hips=new T.Group();g.add(hips);hips.position.y=.95;
  box(hips,skin.coat,0,.26,0,.46,.57,.3);box(hips,skin.accent,0,.24,.16,.14,.45,.025);
  const head=new T.Group();head.position.y=.79;hips.add(head);shape(head,'ball','#ddbc9e',[0,0,0],[.47,.52,.43]);
  shape(head,'ball',skin.hair,[0,.17,-.025],[.51,.32,.46]);
  for(let x of [-.11,.11])box(head,'#26333e',x,-.015,.205,.045,.045,.025);
  if(skin.style==='spike')for(let i=0;i<5;i++){const m=shape(head,'cone',skin.hair,[(i-2)*.095,.33,-.02],[.18,.25+(i%2)*.1,.22]);m.rotation.z=(2-i)*.18;}
  if(skin.style==='bun'||skin.style==='tail')shape(head,'ball',skin.hair,[0,.18,-.27],[.27,skin.style==='tail'?.6:.25,.27]);
  if(skin.style==='twobuns')for(let x of [-.24,.24])shape(head,'ball',skin.hair,[x,.24,0],[.24,.25,.24]);
  if(skin.style==='fringe')box(head,skin.hair,-.09,.08,.18,.22,.18,.1);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new T.Group();arm.position.set(side*.3,.47,0);hips.add(arm);box(arm,skin.coat,0,-.17,0,.15,.34,.17);
    const fore=new T.Group();fore.position.y=-.32;arm.add(fore);box(fore,skin.coat,0,-.14,0,.13,.28,.14);shape(fore,'ball','#ddbc9e',[0,-.3,0],[.15,.17,.16]);arms.push({arm,fore});
    const thigh=new T.Group();thigh.position.set(side*.14,-.05,0);hips.add(thigh);box(thigh,'#26323e',0,-.22,0,.19,.44,.2);
    const shin=new T.Group();shin.position.y=-.43;thigh.add(shin);box(shin,'#26323e',0,-.275,0,.17,.55,.18);box(shin,'#1a242e',0,-.57,.06,.22,.12,.34);legs.push({thigh,shin});
  }
  const cup=shape(arms[1].fore,'cylinder','#e8dfbc',[0,-.3,.07],[.13,.2,.13]);cup.visible=false;
  return {root:g,hips,head,arms,legs,cup};
}
export function poseAvatar(rig,a,time,reduced=false){
  const seated=a.mode==='typing'||a.mode==='lounge',walk=a.mode==='walk',t=reduced?0:time;
  rig.root.position.set(a.p[0],0,a.p[1]);rig.root.rotation.y=a.yaw;
  rig.hips.position.y=seated?.65:1.11;rig.hips.rotation.x=0;rig.head.rotation.y=a.mode==='chat'?Math.sin(t)*.12:0;
  rig.legs.forEach(({thigh,shin},i)=>{thigh.rotation.x=seated?-Math.PI/2:walk?Math.sin(t*8+i*Math.PI)*.43:0;shin.rotation.x=seated?Math.PI/2:walk?Math.max(0,Math.sin(t*8+i*Math.PI))*.5:0;});
  rig.arms.forEach(({arm,fore},i)=>{
    arm.rotation.set(0,0,0);fore.rotation.x=0;
    if(a.mode==='typing'){arm.rotation.x=-1;fore.rotation.x=-.6+Math.sin(t*13+i*Math.PI)*.08;arm.rotation.z=(i?1:-1)*.08;}
    else if(a.mode==='arcade'){arm.rotation.x=-1;fore.rotation.x=-.4+Math.sin(t*9+i)*.12;}
    else if(a.mode==='drink'&&i===1){arm.rotation.x=-1.65-Math.sin(t*1.1)*.18;fore.rotation.x=-.7;}
    else if(a.mode==='chat'){arm.rotation.x=-.3;arm.rotation.z=(i?1:-1)*(.2+Math.sin(t*2+i)*.12);fore.rotation.x=-.5;}
    else if(walk)arm.rotation.x=Math.sin(t*8+i*Math.PI)*-.3;
  });rig.cup.visible=a.mode==='drink';
}
export function disposeShared(){for(const g of Object.values(geo))g.dispose();for(const m of mats.values())m.dispose();mats.clear();}
