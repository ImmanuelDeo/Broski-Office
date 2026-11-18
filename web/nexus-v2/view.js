import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {Kit, plant, decor, desk, character, poseCharacter} from './geometry.js';
import {DEFAULT_TEAMS, makeLayout, OfficeSimulation, timePalette, random} from './model.js';

/** Owns only a visual container. The host owns API polling and all business actions. */
export class NexusOfficeView {
 constructor(container,{teams=DEFAULT_TEAMS,onInspect=()=>{},quality='balanced',timeMode='auto',hour=17.5,motion=true,skins={}}={}){
  if(!container)throw Error('A dedicated office viewport is required');
  this.container=container;this.onInspect=onInspect;this.quality=quality;this.timeMode=timeMode;this.hour=hour;
  this.motion=motion;this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.active=true;this.disposed=false;this.labels=[];this.eventAbort=new AbortController();
  this.rooms=makeLayout(teams);this.sim=new OfficeSimulation(this.rooms);for(const w of this.sim.workers)if(skins[w.id])w.skin=skins[w.id];
  this.k=new Kit();this.scene=new T.Scene();this.scene.fog=new T.Fog('#b6909e',70,165);
  this.renderer=new T.WebGLRenderer({antialias:quality!=='low',alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='high'?2:1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.renderer.shadowMap.enabled=quality!=='low';this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.canvas=this.renderer.domElement;this.canvas.className='nx-canvas';this.canvas.setAttribute('aria-label','Kantor Nexus 3D. Gunakan kontrol tampilan untuk mengubah kamera.');container.append(this.canvas);
  this.overlay=document.createElement('div');this.overlay.className='nx-labels';container.append(this.overlay);
  this.camera=new T.OrthographicCamera(-25,25,20,-20,.1,250);this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.minZoom=.6;this.controls.maxZoom=3;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minPolarAngle=.07;this.controls.target.set(0,0,1);
  this.controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN};
  this.ambient=new T.HemisphereLight('#e1f5ef','#5e6a79',2.1);this.scene.add(this.ambient);
  this.sun=new T.DirectionalLight('#ffd4a0',2);this.sun.position.set(-15,28,4);this.sun.castShadow=true;this.sun.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);
  Object.assign(this.sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:80});this.sun.shadow.bias=-.001;this.sun.shadow.normalBias=.04;this.scene.add(this.sun);
  this.fill=new T.DirectionalLight('#c3ddd9',1.35);this.fill.position.set(12,20,30);this.scene.add(this.fill);
  this.skyCanvas=document.createElement('canvas');this.skyCanvas.width=4;this.skyCanvas.height=256;this.skyTexture=new T.CanvasTexture(this.skyCanvas);this.skyTexture.colorSpace=T.SRGBColorSpace;this.skyColor=new T.Color('#b6909e');this.skyTick=0;this.scene.background=this.skyTexture;
  this.rigs=new Map();this.particleMeshes=[];this.build();this.home();this.resize();
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  this.visibilityObserver=new IntersectionObserver(entries=>{this.active=entries[0].isIntersecting;});this.visibilityObserver.observe(container);
  this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.contextLost=true;container.dispatchEvent(new CustomEvent('nexus-renderer-lost',{bubbles:true}));},{signal:this.eventAbort.signal});
  this.canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.resize();},{signal:this.eventAbort.signal});
  this.last=performance.now();this.boundLoop=t=>this.loop(t);this.raf=requestAnimationFrame(this.boundLoop);
 }
 label(text,pos,kind,object){const el=document.createElement('button');el.type='button';el.className='nx-label nx-label-'+kind;el.textContent=text;el.addEventListener('click',()=>this.onInspect(object),{signal:this.eventAbort.signal});this.overlay.append(el);const label={el,pos,kind,object};this.labels.push(label);return label;}
 build(){
    const k=this.k,s=this.scene;const zmax=Math.max(...this.rooms.map(r=>r.z+r.depth/2),12.5)+2,zmin=-14.5,depth=zmax-zmin,width=Math.max(...this.rooms.map(r=>Math.abs(r.x)+r.width/2))*2+3;
  this.bounds={width,depth,cz:(zmin+zmax)/2};
  // A cutaway floor high above a city, with visible facade levels underneath.
  k.box(s,'#152b38',[0,-.5,(zmax+zmin)/2],[width,1,depth]);k.box(s,'#2a424a',[0,-.015,(zmax+zmin)/2],[width-.3,.12,depth-.3]);
  for(let i=0;i<3;i++){k.box(s,'#132637',[0,-1.4-i*.9,zmax-.18],[width-.5,.72,.12]);k.box(s,'#4c6470',[0,-1.8-i*.9,zmax],[width,.08,.2]);}
  for(let x=-width/2+.6;x<width/2;x+=1.2)k.box(s,'#567783',[x,-2.2,zmax+.02],[.045,2.7,.05]);
  k.box(s,'#71988e',[0,-.38,zmax+.06],[width,.035,.06],true);
  // Warm timber cross circulation and a dark central memory plaza.
  k.box(s,'#86755f',[0,.07,0],[5.5,.05,depth-.7]);k.box(s,'#927e65',[0,.075,0],[width-.7,.055,2.1]);
  for(let z=zmin+.5;z<zmax;z+=.5)k.box(s,'#7a6958',[0,.11,z],[5.3,.006,.018]);
  for(const x of [-2.6,2.6])k.box(s,'#8fcec0',[x,.12,0],[.025,.015,depth-.8],true);
  // Back perimeter glazing. Omit near panes for a readable dollhouse view.
  for(let x=-width/2+.3;x<width/2;x+=3.2){k.box(s,'#a7ccd3',[x+1.55,2.4,zmin+.25],[3.05,4.6,.04],false,.1);k.box(s,'#68858d',[x,2.4,zmin+.25],[.055,4.8,.09]);}
  k.box(s,'#8ca0a4',[0,4.8,zmin+.25],[width,.09,.12]);k.box(s,'#354f58',[0,.2,zmin+.25],[width,.35,.2]);
  // Near railing: discreet, transparent glass rather than an enclosing wall.
  k.box(s,'#82bdc0',[0,.55,zmax-.45],[width-.8,1,.035],false,.08);k.box(s,'#6b8b90',[0,1.07,zmax-.45],[width-.8,.035,.05]);
for(const room of this.rooms){
    this.buildRoom(room);
  }
  this.buildBrain();this.buildCity();
  for(let i=0;i<24*4;i++){const m=k.ball(s,'#b6ffe4',[0,-10,0],[.055,.055,.055],0);m.material=k.mat('#b6ffe4',true);m.visible=false;this.particleMeshes.push(m);}
  for(const w of this.sim.workers){const rig=character(k,w.skin);s.add(rig.root);rig.root.position.set(w.pos.x,0,w.pos.z);rig.body.position.y=.64;this.rigs.set(w.id,rig);const label=this.label(w.name,new T.Vector3(w.pos.x,2.15,w.pos.z),'agent',{kind:'agent',id:w.id});label.worker=w;}
 }
 buildRoom(r){const k=this.k,s=this.scene;
  k.box(s,'#203740',[r.x,.13,r.z],[r.width,.18,r.depth]);k.box(s,'#33464c',[r.x,.235,r.z],[r.width-.45,.03,r.depth-.4]);
  // Rear acoustic wall and low sides. Door gap faces the shared corridor.
  k.box(s,'#3a4e55',[r.x,1.17,r.z-r.depth/2],[r.width,.24+2,.18]);
  k.box(s,r.color,[r.x,2.3,r.z-r.depth/2],[r.width,.06,.2],true);
  const outer=r.x<0?r.x-r.width/2:r.x+r.width/2;
  k.box(s,'#465c61',[outer,.6,r.z],[.15,.9,r.depth]);
  const inner=r.x<0?r.x+r.width/2:r.x-r.width/2;
  for(const side of [-1,1])k.box(s,'#52666a',[inner,.6,r.z+side*3.5],[.14,.9,3.7]);
  k.box(s,r.color,[r.x,.26,r.z+r.depth/2-.12],[r.width-.25,.035,.06],true);
  for(let i=0;i<5;i++)k.box(s,i%2?'#2c3d46':'#263b43',[r.x+(i-2)*2.4,1.4,r.z-r.depth/2+.12],[1.7,1.15,.06]);
  // Room name plaque on the floor-facing edge stays readable as the camera rotates.
  this.label(r.name,new T.Vector3(r.x,.75,r.z+r.depth/2+.1),'room',{kind:'team',id:r.id});
  const furniture=new T.Group();furniture.position.y=.25;s.add(furniture);
  for(const w of r.workers)desk(k,furniture,w.seat.x,w.seat.z-1.05,r.color);
  for(const item of r.decor){if(['arcade','water'].includes(item.kind)){const machine=new T.Group();machine.position.set(item.x,0,item.z);machine.rotation.y=Math.PI;furniture.add(machine);decor(k,machine,{...item,x:0,z:0},r.color);}else decor(k,furniture,item,r.color);}
  // Whiteboard, books and warm lamps enrich the rear wall.
  k.box(s,'#cad6cb',[r.x+5,1.5,r.z-5.35],[1.6,.9,.07]);
  for(let i=0;i<4;i++)k.box(s,i%2?r.color:'#799287',[r.x+4.6+(i%2)*.6,1.7-Math.floor(i/2)*.3,r.z-5.3],[.28,.2,.02]);
  for(const dx of [-5.8,5.8]){k.cyl(s,'#a59978',[r.x+dx,1.4,r.z+.1],.035,2.4);k.cyl(s,'#e9d5a6',[r.x+dx,2.56,r.z+.1],.28,.22,true);k.cyl(s,'#303c40',[r.x+dx,.26,r.z+.1],.22,.07);}
 }
 buildBrain(){const k=this.k,s=this.scene;
  k.cyl(s,'#19313a',[0,.25,0],2.4,.3);k.cyl(s,'#2e4a50',[0,.48,0],2.15,.18);k.ring(s,'#84dbc5',[0,.6,0],2.05);k.ring(s,'#709c9d',[0,.61,0],1.65,.015);k.cyl(s,'#57747b',[0,.95,0],.34,.9);
  this.brain=new T.Group();this.brain.position.y=2.4;s.add(this.brain);
  for(const side of [-1,1]){k.ball(this.brain,'#b38ba6',[side*.4,0,0],[.58,.77,.7],2);
   for(let i=0;i<13;i++){const a=i*2.4,y=(i/12-.5)*1.15;const rad=Math.sqrt(Math.max(.05,1-(y/.8)**2));k.ball(this.brain,i%3?'#bf95ae':'#9c7d9e',[side*(.34+Math.abs(Math.cos(a))*.38*rad),y,Math.sin(a)*.58*rad],[.22,.19,.23],1);}}
  this.halo=k.ring(s,'#9ae4d6',[0,1.45,0],1.2,.018);this.brainLight=new T.PointLight('#b8f8d9',4,8);this.brainLight.position.set(0,2.5,0);s.add(this.brainLight);
  const l=this.label('BIG BRAIN · SHARED MEMORY',new T.Vector3(0,4.1,0),'brain',{kind:'brain'});this.brainLabel=l.el;
  for(const room of this.rooms){const curve=new T.CatmullRomCurve3([new T.Vector3(0,.3,0),new T.Vector3(room.x/2,.3,0),new T.Vector3(room.x,.3,room.z)]);const line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(35)),new T.LineBasicMaterial({color:room.color,transparent:true,opacity:.28}));s.add(line);}
 }
 buildCity(){const k=this.k,s=this.scene,rng=random('city-48');this.windowMaterial=new T.MeshBasicMaterial({color:'#ffdb9f',transparent:true,opacity:.5});const matrices=[];
  // Buildings originate well below the office floor, making the elevation visible.
  for(let i=0;i<36;i++){let x=(rng()-.5)*125,z=-28-rng()*60;const w=3+rng()*5,d=4+rng()*7,h=65+rng()*31,base=-79;
   k.box(s,i%3?'#405b70':'#596778',[x,base+h/2,z],[w,h,d]);k.box(s,'#65768a',[x,base+h+.12,z],[w+.2,.24,d+.2]);
   if(i%4===0)k.cyl(s,'#7c91a4',[x,base+h+1.2,z],.04,2.3);
   for(let y=base+2;y<base+h-1;y+=1.4)for(let xx=x-w/2+.45;xx<x+w/2-.2;xx+=.75)if(rng()>.25){const m=new T.Matrix4().compose(new T.Vector3(xx,y,z+d/2+.015),new T.Quaternion(),new T.Vector3(.28,.47,.02));matrices.push(m);}
  }
  const windows=new T.InstancedMesh(k.geo('box',()=>new T.BoxGeometry(1,1,1)),this.windowMaterial,matrices.length);matrices.forEach((m,i)=>windows.setMatrixAt(i,m));s.add(windows);
  this.sunDisc=k.ball(s,'#ffdfb5',[-36,17,-75],[4,4,4],2);this.sunDisc.material=new T.MeshBasicMaterial({color:'#ffdfb5'});
  // Roof garden planters along the outer ledge.
  for(const x of [-18,18])for(const z of [-11,2,12])plant(k,s,x,z,1.1);
 }
 resize(){if(this.disposed)return;const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);this.renderer.setSize(w,h,false);this.aspect=w/h;const span=Math.max(this.bounds.depth*.54,16,this.bounds.width*.64/this.aspect);this.span=span;this.camera.left=-span*this.aspect;this.camera.right=span*this.aspect;this.camera.top=span;this.camera.bottom=-span;this.camera.updateProjectionMatrix();}
 home(){this.camera.position.set(30,33,40);this.controls.target.set(0,0,this.bounds.cz);this.camera.zoom=1.08;this.camera.updateProjectionMatrix();this.controls.update();}
 top(){this.camera.position.set(.01,55,this.bounds.cz+.01);this.controls.target.set(0,0,this.bounds.cz);this.camera.zoom=1;this.controls.update();}
 focus(id){const w=this.sim.workers.find(a=>a.id===id),r=this.rooms.find(a=>a.id===id);const p=w?.pos||r;if(!p)return;this.controls.target.set(p.x,.7,p.z);this.camera.position.set(p.x+14,17,p.z+18);this.camera.zoom=1.65;this.camera.updateProjectionMatrix();this.controls.update();}
 setTime(mode,hour){if(!['auto','manual'].includes(mode))throw Error('Invalid time mode');this.timeMode=mode;if(Number.isFinite(hour))this.hour=hour;}
 setMotion(enabled){this.motion=!!enabled;}
 update(frame){this.frame=this.sim.apply(frame);if(this.frame.memoryBytes!=null)this.brainLabel.textContent='BIG BRAIN · '+(this.frame.memoryBytes/1024).toFixed(1)+' KiB';}
 knowledge(event){return this.sim.knowledge(event);}
 environment(dt){const target=this.timeMode==='auto'?new Date().getHours()+new Date().getMinutes()/60:this.hour;
  const {a,b,t}=timePalette(target),color=(key)=>new T.Color(a[key]).lerp(new T.Color(b[key]),t);const smooth=1-Math.exp(-dt*1.5);
  this.skyColor.lerp(color('sky'),smooth);this.scene.fog.color.copy(this.skyColor);
  this.skyTick+=dt;if(this.skyTick>.08){this.skyTick=0;const ctx=this.skyCanvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,256);const top=this.skyColor.clone().lerp(new T.Color('#101d38'),.68);const bottom=this.skyColor.clone().lerp(new T.Color('#1b3042'),.28);gradient.addColorStop(0,'#'+top.getHexString());gradient.addColorStop(.55,'#'+this.skyColor.getHexString());gradient.addColorStop(1,'#'+bottom.getHexString());ctx.fillStyle=gradient;ctx.fillRect(0,0,4,256);this.skyTexture.needsUpdate=true;}
  this.sun.color.lerp(color('sun'),smooth);this.sun.intensity+=(a.intensity+(b.intensity-a.intensity)*t-this.sun.intensity)*smooth;
  this.ambient.intensity+=(a.ambient+(b.ambient-a.ambient)*t-this.ambient.intensity)*smooth;
  this.windowMaterial.opacity+=(a.windows+(b.windows-a.windows)*t-this.windowMaterial.opacity)*smooth;
  this.sunDisc.visible=target>5&&target<19;this.sunDisc.position.y=8+Math.sin((target-5)/14*Math.PI)*20;this.sunDisc.position.x=-40+(target-6)*4;
 }
 loop(now){if(this.disposed)return;this.raf=requestAnimationFrame(this.boundLoop);let dt=Math.min((now-this.last)/1000,.1);this.last=now;
  const rect=this.container.getBoundingClientRect();this.active=rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
  // Allow rendering even in background tabs for automation
if(!this.active||this.contextLost){console.log('[Nexus-v2] skipping frame');return;}
  const moving=this.motion&&!this.reduced.matches;this.sim.tick(dt,moving);this.controls.update();this.environment(dt);
  if(moving){this.brain.rotation.y=Math.sin(this.sim.time*.3)*.09;this.brain.position.y=2.4+Math.sin(this.sim.time*1.2)*.045;}
  for(const w of this.sim.workers){const rig=this.rigs.get(w.id);poseCharacter(rig,w,this.sim.time,dt,moving);rig.glow.visible=this.sim.pulses.some(p=>p.agentId===w.id&&p.age>2);}
  for(const m of this.particleMeshes)m.visible=false;
  if(moving)this.sim.pulses.forEach((p,i)=>{const w=this.sim.workers.find(a=>a.id===p.agentId);if(!w)return;for(let j=0;j<4;j++){const u=Math.max(0,Math.min(1,p.age/p.duration-j*.045)),m=this.particleMeshes[i*4+j];m.visible=u>0&&u<1;const x=w.pos.x*u,z=w.pos.z*u,y=2.7+(1.7-2.7)*u+Math.sin(u*Math.PI)*3.6;m.position.set(x,y,z);m.rotation.y=this.sim.time*3;}});
  for(const l of this.labels){if(l.worker){l.pos.set(l.worker.pos.x,2.15,l.worker.pos.z);l.el.dataset.status=l.worker.status;const t=l.worker.name+' · '+l.worker.status+' · '+(l.worker.skin?.name||'no skin');l.el.title=t;l.el.setAttribute('title',t);}
   const p=l.pos.clone().project(this.camera);l.el.style.left=((p.x+1)*.5*100)+'%';l.el.style.top=((-p.y+1)*.5*100)+'%';l.el.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;
  }
this.renderer.render(this.scene,this.camera);
 }
 stats(){return {workers:this.sim.workers.length,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures};}
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.eventAbort.abort();this.resizeObserver.disconnect();this.visibilityObserver.disconnect();this.controls.dispose();this.k.dispose();
  this.scene.traverse(o=>{if(o.isLine){o.geometry.dispose();o.material.dispose();}});this.sun.shadow.dispose();this.skyTexture.dispose();this.windowMaterial.dispose();this.sunDisc.material.dispose();this.renderer.dispose();this.canvas.remove();this.overlay.remove();}
}
