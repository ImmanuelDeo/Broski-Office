// Exports editable mesh assets from the same geometry primitives used by the UI.
import {Geometry} from '../web/scene.js';
import {writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../models/',import.meta.url));mkdirSync(out,{recursive:true});
function save(name,g){let lines=['# Nexus procedural mesh; MIT license','# Vertex RGB uses common OBJ extension; materials can be assigned in Blender.'];for(let i=0;i<g.v.length;i+=6)lines.push('v '+g.v.slice(i,i+6).join(' '));for(let i=0;i<g.v.length/6;i+=3)lines.push(`f ${i+1} ${i+2} ${i+3}`);writeFileSync(out+name+'.obj',lines.join('\n')+'\n')}
let b=new Geometry();for(let sign of [-1,1]){b.sphere(sign*.58,0,0,.83,1.02,1.1,'#bd8fae',18,12);for(let j=0;j<13;j++){let a=j*2.399,y=(j/12-.5)*1.5,r=Math.sqrt(Math.max(.1,1-(y/1.25)**2));b.sphere(sign*(.4+Math.abs(Math.cos(a))*.65*r),y,Math.sin(a)*.87*r,.32,.31,.36,'#e0accc',9,6)}}save('big-brain',b);
let a=new Geometry();a.box(0,.9,0,.69,.65,.42,'#a4c7f4');a.box(0,1.48,0,.52,.52,.49,'#e8b594');a.box(0,1.77,0,.57,.15,.53,'#303847');for(let s of [-1,1]){a.box(s*.18,.3,0,.23,.52,.27,'#26333f');a.box(s*.44,.85,0,.17,.6,.18,'#a4c7f4')}save('agent-base',a);
let r=new Geometry();r.box(0,0,0,10,.3,8,'#304653');r.box(0,1.25,-3.9,10,2.5,.18,'#405865');r.box(-4.9,.85,0,.16,1.7,8,'#354e5c');r.box(0,1.1,0,2.2,.16,1.15,'#a0b7b7');r.box(0,1.55,-.24,1.15,.72,.12,'#122431');save('room-base',r);console.log('Exported big-brain.obj, agent-base.obj, room-base.obj');
