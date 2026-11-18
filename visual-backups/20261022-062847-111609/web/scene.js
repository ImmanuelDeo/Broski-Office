/* Small, dependency-free WebGL 3D renderer. Actual depth-tested triangle meshes. */
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
export class Geometry {
 constructor(){this.v=[];}
 tri(a,b,c,col){let u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;let light=.63+.37*Math.max(0,(n[0]*-.35+n[1]*.85+n[2]*.4)/l);for(let p of [a,b,c])this.v.push(...p,...col.map(x=>x*light));}
 quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);}
 box(x,y,z,w,h,d,color){let c=rgb(color),a=x-w/2,b=x+w/2,l=y-h/2,u=y+h/2,f=z-d/2,k=z+d/2;this.quad([a,u,f],[a,u,k],[b,u,k],[b,u,f],c);this.quad([a,l,k],[a,u,k],[a,u,f],[a,l,f],c);this.quad([b,l,f],[b,u,f],[b,u,k],[b,l,k],c);this.quad([a,l,f],[a,u,f],[b,u,f],[b,l,f],c);this.quad([b,l,k],[b,u,k],[a,u,k],[a,l,k],c);this.quad([a,l,k],[a,l,f],[b,l,f],[b,l,k],c);}
 sphere(x,y,z,rx,ry,rz,color,seg=12,rings=8){if(Geometry.low){seg=Math.min(seg,7);rings=Math.min(rings,4)}let c=rgb(color);let p=(a,b)=>[x+rx*Math.sin(b)*Math.cos(a),y+ry*Math.cos(b),z+rz*Math.sin(b)*Math.sin(a)];for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){let a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2,t=j/rings*Math.PI,s=(j+1)/rings*Math.PI;this.quad(p(a,t),p(a,s),p(b,s),p(b,t),c);}}
 tube(a,b,r,color,seg=8){if(Geometry.low)seg=Math.min(seg,4);let d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);d=d.map(v=>v/len);let q=Math.abs(d[1])<.9?[0,1,0]:[1,0,0];let u=[d[1]*q[2]-d[2]*q[1],d[2]*q[0]-d[0]*q[2],d[0]*q[1]-d[1]*q[0]],ul=Math.hypot(...u);u=u.map(v=>v/ul);let v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]];let pt=(p,t)=>p.map((n,i)=>n+r*(Math.cos(t)*u[i]+Math.sin(t)*v[i]));let c=rgb(color);for(let i=0;i<seg;i++){let t=i/seg*2*Math.PI,s=(i+1)/seg*2*Math.PI;this.quad(pt(a,t),pt(b,t),pt(b,s),pt(a,s),c);this.tri(a,pt(a,s),pt(a,t),c);this.tri(b,pt(b,t),pt(b,s),c);}}
 ring(x,y,z,r,t,color){let steps=Geometry.low?16:56;for(let i=0;i<steps;i++){let a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2;this.tube([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],t,color,5);}}
}
export class OfficeScene {
 constructor(canvas,labels,onSelect){this.canvas=canvas;this.labels=labels;this.onSelect=onSelect;this.yaw=.55;this.pitch=.72;this.scale=18;this.center=[0,0,0];this.items=[];this.state=null;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.paused=false;this.frame=0;
  let gl=canvas.getContext('webgl',{antialias:true,alpha:false});this.software=!gl;Geometry.low=this.software;if(!gl)gl=this.softwareContext(canvas);this.gl=gl;
  const vs=`attribute vec3 p;attribute vec3 c;varying vec3 col;uniform vec3 center;uniform float yaw,pitch,scale,aspect;void main(){vec3 q=p-center;float x=cos(yaw)*q.x-sin(yaw)*q.z;float z=sin(yaw)*q.x+cos(yaw)*q.z;float y=cos(pitch)*q.y-sin(pitch)*z;float depth=sin(pitch)*q.y+cos(pitch)*z;gl_Position=vec4(x/(scale*aspect),y/scale,-depth/150.0,1.0);col=c;}`;
  const fs=`precision mediump float;varying vec3 col;void main(){gl_FragColor=vec4(col,1.0);}`;
  const shader=(type,src)=>{let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.pos=gl.getAttribLocation(this.program,'p');this.col=gl.getAttribLocation(this.program,'c');this.uniforms=Object.fromEntries(['center','yaw','pitch','scale','aspect'].map(k=>[k,gl.getUniformLocation(this.program,k)]));this.staticBuffer=gl.createBuffer();this.dynamicBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.clearColor(.035,.055,.080,1);
  let down=null;canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!down)return;this.yaw+=(e.clientX-down.x)*.006;this.pitch=Math.max(.25,Math.min(1.35,this.pitch+(e.clientY-down.y)*.004));down.x=e.clientX;down.y=e.clientY});
  canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.sx,e.clientY-down.sy)<6){let r=canvas.getBoundingClientRect();let target=this.items.map(x=>({...x,p:this.project(x.pos)})).filter(x=>Math.hypot(x.p[0]-e.clientX+r.left,x.p[1]-e.clientY+r.top)<50).sort((a,b)=>Math.hypot(a.p[0]-e.clientX+r.left,a.p[1]-e.clientY+r.top)-Math.hypot(b.p[0]-e.clientX+r.left,b.p[1]-e.clientY+r.top))[0];if(target)this.onSelect(target.type,target.id)}down=null});
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.scale=Math.max(5,Math.min(70,this.scale*Math.exp(e.deltaY*.001)))} ,{passive:false});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')this.yaw-=.1;if(e.key==='ArrowRight')this.yaw+=.1;if(e.key==='ArrowUp')this.pitch=Math.min(1.35,this.pitch+.1);if(e.key==='ArrowDown')this.pitch=Math.max(.25,this.pitch-.1);if(e.key==='+')this.scale*=.9;if(e.key==='-')this.scale*=1.1;if(e.key==='Home')this.home()});
  new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);this.resize();requestAnimationFrame(t=>this.draw(t));
 }
 softwareContext(canvas){
  // Software fallback projects the same triangle meshes when GPU WebGL is absent.
  // Painter sorting is less precise at intersecting faces than the GPU depth buffer.
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas tidak tersedia pada browser ini.');let bound,triangles=[];const noop=()=>{};
  return {ARRAY_BUFFER:1,STATIC_DRAW:2,DYNAMIC_DRAW:3,FLOAT:4,TRIANGLES:5,DEPTH_TEST:6,VERTEX_SHADER:7,FRAGMENT_SHADER:8,COMPILE_STATUS:9,LINK_STATUS:10,
   createBuffer:()=>({v:[]}),bindBuffer:(_,b)=>bound=b,bufferData:(_,v)=>bound.v=v,
   createShader:()=>({}),shaderSource:noop,compileShader:noop,getShaderParameter:()=>true,createProgram:()=>({}),attachShader:noop,linkProgram:noop,getProgramParameter:()=>true,useProgram:noop,getAttribLocation:()=>0,getUniformLocation:()=>0,enable:noop,clearColor:noop,viewport:noop,uniform3fv:noop,uniform1f:noop,enableVertexAttribArray:noop,vertexAttribPointer:noop,
   clear:()=>{ctx.fillStyle='#09101a';ctx.fillRect(0,0,canvas.width,canvas.height);triangles=[];},
   drawArrays:()=>{let v=bound.v,cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch),k=canvas.height/(this.scale*2);for(let i=0;i<v.length;i+=18){let points=[],depth=0,layer=0;for(let j=0;j<18;j+=6){let x=v[i+j]-this.center[0],y=v[i+j+1]-this.center[1],z=v[i+j+2]-this.center[2],xx=cy*x-sy*z,zz=sy*x+cy*z;points.push([canvas.width/2+xx*k,canvas.height/2-(cp*y-sp*zz)*k]);depth+=sp*y+cp*zz;if(v[i+j+1]>.32)layer=1;}triangles.push({points,depth,layer,color:`rgb(${Math.round(v[i+3]*255)},${Math.round(v[i+4]*255)},${Math.round(v[i+5]*255)})`});}},
   flush:()=>{triangles.sort((a,b)=>a.layer-b.layer||a.depth-b.depth);for(let tri of triangles){let p=tri.points;if(p.every(a=>a[0]<0)||p.every(a=>a[0]>canvas.width)||p.every(a=>a[1]<0)||p.every(a=>a[1]>canvas.height))continue;ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.lineTo(...p[2]);ctx.closePath();ctx.fillStyle=tri.color;ctx.fill();}}
  };
 }
 resize(){let r=this.canvas.parentElement.getBoundingClientRect();this.w=r.width;this.h=r.height;let d=Math.min(devicePixelRatio,1.6);this.canvas.width=Math.round(this.w*d);this.canvas.height=Math.round(this.h*d);this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}
 home(){this.center=[0,0,0];this.yaw=.55;this.pitch=.72;this.scale=this.fitScale||18;}
 top(){this.yaw=0;this.pitch=1.32;this.center=[0,0,0];}
 focus(type,id){let it=this.items.find(x=>x.type===type&&x.id===id);if(it){this.center=[it.pos[0],0,it.pos[2]];this.scale=type==='brain'?7:9;}}
 project(p){let [x,y,z]=p.map((v,i)=>v-this.center[i]);let xx=Math.cos(this.yaw)*x-Math.sin(this.yaw)*z,zz=Math.sin(this.yaw)*x+Math.cos(this.yaw)*z,yy=Math.cos(this.pitch)*y-Math.sin(this.pitch)*zz;return [this.w/2+xx/this.scale*this.h/2,this.h/2-yy/this.scale*this.h/2]}
 label(text,sub,pos,type,id,color){let el=document.createElement('button');el.className='world-label '+type;let strong=document.createElement('strong');strong.textContent=text;let small=document.createElement('span');small.textContent=sub;el.append(strong,small);el.style.setProperty('--accent',color);el.onclick=()=>this.onSelect(type,id);this.labels.append(el);let item={el,pos,type,id,sub:small};this.items.push(item);return item;}
 build(teams){this.teams=teams;this.labels.replaceChildren();this.items=[];this.agents=[];this.rooms=[];let g=new Geometry();let rings=Math.ceil(teams.length/4),extent=17+(rings-1)*16;this.fitScale=18+(rings-1)*13;this.scale=this.fitScale;
  g.box(0,-.5,0,extent*2,.7,extent*1.8,'#172632');g.box(0,-.91,0,extent*2+.25,.2,extent*1.8+.25,'#314856');
  for(let x=-extent+1;x<extent;x+=1.5)g.box(x,-.137,0,.018,.01,extent*1.8,'#253744');for(let z=-extent*.9+1;z<extent*.9;z+=1.5)g.box(0,-.132,z,extent*2,.01,.018,'#253744');
  g.box(0,-.1,0,6,.1,extent*1.8-.5,'#223a47');g.box(0,-.08,0,extent*2-.5,.1,3.2,'#223a47');
  teams.forEach((team,i)=>{let ring=Math.floor(i/4),s=i%4,x=(s%2===0?-1:1)*(9+ring*16),z=(s<2?-1:1)*(7.5+ring*10);this.rooms.push({id:team.id,x,z,color:team.color});
   g.box(x,.04,z,10,.3,8,'#263a48');g.box(x,.21,z,9.7,.06,7.7,'#304653');g.box(x,.26,z+3.8,9.7,.04,.06,team.color);
   g.box(x,1.25,z-3.9,10,2.5,.18,'#405865');g.box(x-4.9,.85,z,.16,1.7,8,'#354e5c');g.box(x,2.52,z-3.9,10,.06,.22,team.color);
   for(let k=-4;k<=4;k+=2){g.box(x+k,1.9,z-3.78,1.4,.62,.035,'#132831');g.box(x+k,1.9,z-3.75,1.2,.04,.02,team.color)}
   // Light strips, entrance pads, storage, plants, and wall displays.
   g.box(x,.3,z+4.1,2,.1,.5,'#5f867f');g.box(x+4.1,.7,z-2.6,1,1,1.6,'#21333f');g.box(x+4.1,1.25,z-2.6,.9,.1,1.5,team.color);
   for(let q=0;q<2;q++){let px=x+(q?4.1:-4.1),pz=z+2.7;g.tube([px,.3,pz],[px,.85,pz],.33,'#d5cbb7');for(let j=0;j<5;j++)g.sphere(px+Math.cos(j*2)*.22,1.1+j*.08,pz+Math.sin(j*2)*.22,.25,.48,.24,j%2?'#5a9b83':'#75b592',7,5)}
   team.agents.forEach((a,k)=>{let row=Math.floor(k/3),col=k%3,dx=x-2.8+col*2.8,dz=z-1.5+row*2.25;g.box(dx,1.1,dz,2.2,.16,1.15,'#a0b7b7');for(let sx of [-.85,.85])g.box(dx+sx,.64,dz,.08,.9,.65,'#4d626c');g.box(dx,1.55,dz-.24,1.15,.72,.12,'#122431');g.box(dx,1.57,dz-.165,1.0,.54,.025,team.color);g.box(dx,1.18,dz+.29,.8,.04,.28,'#455a64');g.box(dx,.65,dz+1,.8,.18,.8,'#152834');g.box(dx,1.02,dz+1.35,.8,.7,.14,'#233642');g.box(dx,.4,dz+1,.12,.5,.12,'#667f89');g.sphere(dx+.78,1.3,dz+.2,.1,.15,.1,'#e1d7c5',7,5);
    this.agents.push({a,x:dx,y:.27,z:dz+.95,team:team.id,color:team.color});this.label(a.name,a.role,[dx,2.5,dz+.95],'agent',a.id,team.color);
   });
   this.label(team.name,team.agents.length+' agents · idle',[x,.25,z+4.4],'team',team.id,team.color);
   let cx=x>0?x-5:x+5;g.tube([0,.08,0],[cx,.08,0],.035,team.color);g.tube([cx,.08,0],[cx,.08,z],.035,team.color);g.tube([cx,.08,z],[x,.08,z],.035,team.color);
  });
  // Central memory dais.
  g.tube([0,0,0],[0,.48,0],2.6,'#294d58',64);g.tube([0,.48,0],[0,.65,0],2.32,'#18333f',64);g.ring(0,.68,0,2.18,.045,'#8ce9d3');g.ring(0,.69,0,1.65,.025,'#539d9a');g.tube([0,.6,0],[0,1.3,0],.55,'#436274',24);g.ring(0,1.3,0,.8,.06,'#9ce6dc');
  for(let i=0;i<8;i++){let a=i*Math.PI/4,x=Math.cos(a)*2.5,z=Math.sin(a)*2.5;g.box(x,.85,z,.2,.5,.2,'#8ae1ca')}
  this.brainLabel=this.label('BIG BRAIN','Shared memory · 0 B',[0,5.9,0],'brain','brain','#90e1cd');this.staticCount=g.v.length/6;let gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.v),gl.STATIC_DRAW);
 }
 update(state){this.state=state;if(!this.teams||JSON.stringify(this.teams)!==JSON.stringify(state.teams))this.build(state.teams);this.brainLabel.sub.textContent=state.memory.bytes.toLocaleString()+' bytes · '+state.memory.sources.length+' sources';for(let it of this.items){if(it.type==='team'){let active=state.tasks.filter(t=>t.status==='running'&&state.teams.find(x=>x.id===it.id).agents.some(a=>a.id===t.agent)).length;it.sub.textContent=active?active+' agents working':'Team ready';}if(it.type==='agent'){let t=state.tasks.find(t=>t.agent===it.id&&t.status==='running');it.el.classList.toggle('active',!!t);it.sub.textContent=t?t.progress+'% · '+t.message:this.agents.find(x=>x.a.id===it.id).a.role;}}}
 draw(ms){requestAnimationFrame(t=>this.draw(t));if(!this.teams||!this.w||!this.h)return;if(ms-this.frame<(this.software?500:32))return;this.frame=ms;let key=JSON.stringify([this.yaw,this.pitch,this.scale,this.center,this.w,this.h,this.state?.tasks.map(x=>[x.id,x.status,x.progress]),this.paused]);if(this.software&&key===this.lastKey&&!this.state?.tasks.some(x=>x.status==='running'))return;this.lastKey=key;let t=(this.paused||this.reduced)?0:ms*.001,gl=this.gl;
  let g=new Geometry(),float=Math.sin(t*1.3)*.13;
  // Procedural brain with two hemispheres and cortical folds.
  for(let sign of [-1,1]){g.sphere(sign*.58,3.3+float,0,.83,1.02,1.1,'#bd8fae',18,12);for(let j=0;j<13;j++){let a=j*2.399,yy=(j/12-.5)*1.5,rr=Math.sqrt(Math.max(.1,1-(yy/1.25)**2));g.sphere(sign*(.4+Math.abs(Math.cos(a))*.65*rr),3.3+float+yy,Math.sin(a)*.87*rr,.32,.31,.36,j%2?'#e0accc':'#d6a0c3',9,6)}}
  g.tube([0,1.35,0],[0,2.32+float,0],.07,'#8ce9d3');g.ring(0,2.0+float,0,1.65,.016,'#72bba9');
  for(let i=0;i<8;i++){let a=t*.35+i*Math.PI/4;g.sphere(Math.cos(a)*2,2.0+float,Math.sin(a)*2,.065,.065,.065,'#a0f0d9',6,4)}
  for(let [index,agent] of this.agents.entries()){let active=this.state?.tasks.find(x=>x.agent===agent.a.id&&x.status==='running');let x=agent.x,z=agent.z,y=agent.y;let avatar=agent.a.avatar||{},shirt=avatar.shirt||agent.color,skin=avatar.skin||'#dfaf8d',hair=avatar.hair||'#303041';
   // Read milestone briefly walks toward the shared memory hub.
   if(active&&active.progress>0&&active.progress<=15){let k=(Math.sin(t*1.4)+1)*.22;x*=1-k;z*=1-k;}
   let bounce=active?Math.sin(t*6+index)*.035:0;y+=bounce;
   g.box(x-.18,y+.28,z,.23,.52,.27,'#26333f');g.box(x+.18,y+.28,z,.23,.52,.27,'#26333f');g.box(x-.18,y+.05,z-.06,.27,.12,.43,'#152330');g.box(x+.18,y+.05,z-.06,.27,.12,.43,'#152330');
   g.box(x,y+.84,z,.69,.65,.42,shirt);g.box(x-.44,y+.8+(active?Math.sin(t*8)*.06:0),z-.08,.17,.6,.18,shirt);g.box(x+.44,y+.8+(active?Math.cos(t*8)*.06:0),z-.08,.17,.6,.18,shirt);
   g.box(x,y+1.43,z,.52,.52,.49,skin);g.box(x,y+1.72,z,.57,.15,.53,hair);g.box(x,y+1.52,z+.23,.55,.34,.08,hair);g.box(x-.12,y+1.44,z-.25,.065,.07,.02,'#273038');g.box(x+.12,y+1.44,z-.25,.065,.07,.02,'#273038');
   g.ring(x,y+.01,z,.58,.025,active?'#97ebcc':'#466575');if(active){g.sphere(x,y+2,z,.075,.075,.075,'#a5f1d4',7,5);let k=(t*.25+index*.12)%1;g.sphere(x*(1-k),.3+Math.sin(k*Math.PI)*1.3,z*(1-k),.08,.08,.08,agent.color,6,4)}
  }
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniform3fv(this.uniforms.center,this.center);gl.uniform1f(this.uniforms.yaw,this.yaw);gl.uniform1f(this.uniforms.pitch,this.pitch);gl.uniform1f(this.uniforms.scale,this.scale);gl.uniform1f(this.uniforms.aspect,this.w/this.h);
  const render=(buffer,count)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(this.pos);gl.enableVertexAttribArray(this.col);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(this.col,3,gl.FLOAT,false,24,12);gl.drawArrays(gl.TRIANGLES,0,count)};
  render(this.staticBuffer,this.staticCount);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(g.v),gl.DYNAMIC_DRAW);render(this.dynamicBuffer,g.v.length/6);if(this.software)gl.flush();
  for(let it of this.items){let [x,y]=this.project(it.pos);it.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;it.el.hidden=x<0||y<0||x>this.w||y>this.h||it.type==='agent'&&this.scale>23;}
 }
}
