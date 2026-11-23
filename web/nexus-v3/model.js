import {AGENTS,TEAMS} from './roster.js';
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function timePalette(hour){
 const keys=[
  {h:0,sky:'#141d33',fog:'#1b2840',sun:'#9db8e8',intensity:.9,ambient:1.6,windows:1},
  {h:6,sky:'#a2bfcd',fog:'#b9c9cb',sun:'#ffe2b1',intensity:2.5,ambient:1.9,windows:.1},
  {h:12,sky:'#c6cec0',fog:'#bcc7bd',sun:'#fff2d7',intensity:2.6,ambient:2,windows:0},
  {h:17,sky:'#c79a80',fog:'#cba98f',sun:'#ffc28c',intensity:2.3,ambient:1.7,windows:.55},
  {h:20,sky:'#141d33',fog:'#1b2840',sun:'#9db8e8',intensity:.9,ambient:1.6,windows:1},
  {h:24,sky:'#141d33',fog:'#1b2840',sun:'#9db8e8',intensity:.9,ambient:1.6,windows:1}
 ];
 hour=((hour%24)+24)%24;let i=0;while(keys[i+1].h<hour)i++;return {a:keys[i],b:keys[i+1],t:(hour-keys[i].h)/(keys[i+1].h-keys[i].h)};
}
export function random(seed=170){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export function createLayout(seed=170){
  const rng=random(seed),walls=[],props=[],seats=[],anchors=[];
  const add=(team,kind,x,z,w,d,extra={})=>{const p={id:`${team.id}-${kind}-${props.length}`,team:team.id,kind,x:x+team.center[0],z:z+team.center[1],w,d,...extra};props.push(p);return p;};
  for(const team of TEAMS){
    const [cx,cz]=team.center,inner=cx<0?1:-1;
    walls.push({x:cx,z:cz-6,w:16,d:.22,h:2.5},{x:cx,z:cz+6,w:16,d:.22,h:.65},
      {x:cx-inner*8,z:cz,w:.22,d:12,h:1.3},
      {x:cx+inner*8,z:cz-2.5,w:.22,d:7,h:1.3},
      {x:cx+inner*8,z:cz+5,w:.22,d:2,h:1.3}); // doorway z+1..4
    const workers=AGENTS.filter(a=>a.team===team.id);
    workers.forEach((a,i)=>{
      const x=workers.length===4?-5.4+i*3.55:-2.7+i*5.4;
      add(team,'desk',x,-3.7,2.65,1.25);
      // Chair is an intentional interaction volume, not a navigation obstacle.
      add(team,'chair',x,-2.6,.75,.8,{solid:false});
      seats.push({id:a.id,team:team.id,x:x+cx,z:cz-2.6,yaw:Math.PI});
    });
    const arcade=add(team,'arcade',-6,0,1.15,1.1);
    const water=add(team,'water',6,-.3,.8,.8);
    const bag=add(team,'beanbag',-5,4.2,1.5,1.5,{variant:rng()>.5?0:1});
    add(team,'rug',-4.8,3.8,4.2,3,{solid:false});
    add(team,'coffee',-2.9,4.3,.8,.8);
    add(team,'shelf',5,-5.3,3,.6,{theme:team.theme});
    add(team,'feature',1.7,4.5,2.4,1.1,{theme:team.theme});
    for(const [x,z] of [[-7,-5],[7,-5],[7,5]]) add(team,'plant',x+(rng()-.5)*.2,z,.65,.65);
    anchors.push({id:arcade.id,kind:'arcade',team:team.id,p:[arcade.x,arcade.z+1.1],yaw:Math.PI},
      {id:water.id,kind:'drink',team:team.id,p:[water.x,water.z+1],yaw:Math.PI},
      {id:bag.id,kind:'lounge',team:team.id,p:[bag.x,bag.z-.3],yaw:Math.PI});
    anchors.push({id:`chat-${team.id}-0`,kind:'chat',team:team.id,p:[cx-.65,cz+1],yaw:Math.PI/2},
      {id:`chat-${team.id}-1`,kind:'chat',team:team.id,p:[cx+.65,cz+1],yaw:-Math.PI/2});
  }
  // Shared collision geometry: exactly the footprints drawn in geometry.js.
  const obstacles=[...walls,...props.filter(p=>p.solid!==false).map(p=>p.kind==='beanbag'?{x:p.x,z:p.z+.5,w:p.w,d:.5}:p),{x:0,z:0,w:2.5,d:2.5}];
  return {teams:TEAMS,walls,props,seats,anchors,obstacles,bounds:{x0:-19,x1:19,z0:-15,z1:15}};
}
export class Navigation {
  constructor(layout,step=.5,radius=.28){this.layout=layout;this.step=step;this.radius=radius;}
  free(p){const b=this.layout.bounds,r=this.radius;return p[0]>b.x0+r&&p[0]<b.x1-r&&p[1]>b.z0+r&&p[1]<b.z1-r&&!this.layout.obstacles.some(o=>o.radius?distance(p,[o.x,o.z])<o.radius+r:Math.abs(p[0]-o.x)<o.w/2+r&&Math.abs(p[1]-o.z)<o.d/2+r);}
  segment(a,b){let n=Math.max(1,Math.ceil(distance(a,b)/.12));for(let i=0;i<=n;i++){let t=i/n;if(!this.free([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]))return false;}return true;}
  path(start,end){
    if(!this.free(start)||!this.free(end))return null;
    if(this.segment(start,end))return [end.slice()];
    const s=this.step,key=p=>`${p[0]},${p[1]}`,point=p=>p.map(n=>n*s);
    // Connect exact endpoints only to grid cells with a collision-free segment.
    const nearest=p=>{let cells=[];const c=p.map(n=>Math.round(n/s));for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){const k=[c[0]+x,c[1]+z],v=point(k);if(this.segment(p,v))cells.push(k);}return cells.sort((a,b)=>distance(point(a),p)-distance(point(b),p))[0];};
    const a=nearest(start),b=nearest(end);if(!a||!b)return null;
    let open=[a],cost=new Map([[key(a),0]]),prev=new Map(),closed=new Set();
    while(open.length){
      open.sort((u,v)=>(cost.get(key(u))+distance(u,b))-(cost.get(key(v))+distance(v,b)));
      const cur=open.shift(),ck=key(cur);if(closed.has(ck))continue;
      if(ck===key(b)){let out=[end.slice()],p=cur;while(p){out.push(point(p));p=prev.get(key(p));}return out.reverse();}
      closed.add(ck);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const n=[cur[0]+dx,cur[1]+dz],nk=key(n),g=cost.get(ck)+1;
        if(closed.has(nk)||!this.segment(point(cur),point(n)))continue;
        if(g<(cost.get(nk)??Infinity)){cost.set(nk,g);prev.set(nk,cur);open.push(n);}
      }
    }return null;
  }
}
export class OfficeSimulation {
  constructor(layout=createLayout(),seed=92){
    this.layout=layout;this.nav=new Navigation(layout);this.random=random(seed);this.time=0;this.claims=new Map();this.nextChat=8;this.onChat=()=>{};
    this.agents=AGENTS.map((a,i)=>{const seat=layout.seats.find(s=>s.id===a.id);return {...a,p:[seat.x,seat.z],yaw:Math.PI,seat,mode:'idle',busy:false,route:[],until:2+i*1.3,goal:null,phase:i*1.37};});
  }
  release(a){if(a.goal)this.claims.delete(a.goal.id);a.goal=null;}
  go(a,target,mode,duration=10){const route=this.nav.path(a.p,target.p);if(!route)return false;this.release(a);a.route=route;a.goal={...target,mode,duration};if(target.id)this.claims.set(target.id,a.id);a.mode='walk';return true;}
  setBusy(id,busy){const a=this.agents.find(a=>a.id===id);if(!a||a.busy===busy)return;a.busy=busy;
    if(busy){this.release(a);a.route=[];this.go(a,{p:[a.seat.x,a.seat.z],yaw:Math.PI},'typing',Infinity);}
    else{this.release(a);a.route=[];a.mode='idle';a.until=this.time+2;}
  }
  pair(){
    const idle=this.agents.filter(a=>!a.busy&&!a.route.length&&a.mode!=='chat');if(idle.length<2)return;
    const a=idle[Math.floor(this.random()*idle.length)],b=idle.find(b=>b!==a&&b.team===a.team)||idle.find(b=>b!==a);
    const anchors=this.layout.anchors.filter(x=>x.team===a.team&&x.kind==='chat');if(anchors.some(x=>this.claims.has(x.id)))return;
    if(!this.nav.path(a.p,anchors[0].p)||!this.nav.path(b.p,anchors[1].p))return;
    this.go(a,anchors[0],'chat',18);this.go(b,anchors[1],'chat',18);a.partner=b.id;b.partner=a.id;
  }
  tick(dt){
    this.time+=clamp(dt,0,.1);dt=clamp(dt,0,.1);
    if(this.time>this.nextChat){this.pair();this.nextChat=this.time+24+this.random()*12;}
    for(const a of this.agents){
      if(a.route.length){const p=a.route[0],d=distance(a.p,p),step=Math.min(d,dt*1.6);a.yaw=Math.atan2(p[0]-a.p[0],p[1]-a.p[1]);
        if(d<.01){a.route.shift();if(!a.route.length){a.mode=a.goal.mode;a.yaw=a.goal.yaw??a.yaw;a.until=this.time+a.goal.duration;}continue;}
        const next=[a.p[0]+(p[0]-a.p[0])*step/d,a.p[1]+(p[1]-a.p[1])*step/d];
        // Stable ordering gives right of way; blocked actors wait, never teleport.
        if(this.agents.some(b=>b!==a&&distance(next,b.p)<.48)) {
          a.blocked=(a.blocked||0)+dt;
          if(a.blocked>1.2){
            const dynamic=new Navigation({...this.layout,obstacles:[...this.layout.obstacles,...this.agents.filter(b=>b!==a).map(b=>({x:b.p[0],z:b.p[1],radius:.19}))]},.25);
            const route=dynamic.path(a.p,a.goal.p);
            if(route){a.route=route;a.blocked=0;}
            else if(!a.busy){a.route=[];this.release(a);a.mode='idle';a.until=this.time+.5;}
          }continue;
        }
        a.blocked=0;a.p=next;if(step===d)a.route.shift();
        if(!a.route.length){a.mode=a.goal.mode;a.yaw=a.goal.yaw??a.yaw;a.until=this.time+a.goal.duration;}
      }else if(a.mode==='chat'){
        const b=this.agents.find(b=>b.id===a.partner);
        if(!b||b.busy||this.time>a.until){this.release(a);a.mode='idle';a.until=this.time+2;a.spoke=false;}
        else if(b.mode==='chat'&&!a.spoke){a.spoke=true;if(a.id<b.id)this.onChat(a,b);}
      }else if(!a.busy&&this.time>a.until){
        this.release(a);const options=this.layout.anchors.filter(x=>x.team===a.team&&x.kind!=='chat'&&!this.claims.has(x.id));
        const target=options[Math.floor(this.random()*options.length)];
        if(!target||!this.go(a,target,target.kind,8+this.random()*14)){a.mode='idle';a.until=this.time+3;}
      }
      if(a.busy&&a.mode!=='walk')a.mode='typing';
    }
  }
}
