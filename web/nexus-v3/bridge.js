import {NexusLivingView} from './view.js';
import {AGENTS} from './roster.js';
const ids=new Set(AGENTS.map(a=>a.id));
export function validateState(s){
 if(!s||s.schema_version!==3||!Array.isArray(s.agents)||s.agents.length!==8)throw new Error('Expected canonical Nexus v3 state with exactly 8 active agents; wire projectState first.');
 const seen=new Set();for(const a of s.agents){if(!ids.has(a.id)||seen.has(a.id)||!['idle','queued','running','reviewing','recovering','blocked','offline'].includes(a.status))throw new Error('Invalid or duplicate agent state');seen.add(a.id);}
 if(typeof s.connected!=='boolean'||!Array.isArray(s.events))throw new Error('connected/events required');
 if(s.memory_bytes!==null&&(!Number.isSafeInteger(s.memory_bytes)||s.memory_bytes<0))throw new Error('memory_bytes must be a non-negative integer or null');
 return s;
}
// Reuse the existing app.js polling loop. No extra fetch loop, auth token or task mutations.
const mounts=new WeakMap();
export function mountLivingOffice({container,projectState=s=>s,onSelect,quality='balanced',onError=console.error}){
 if(mounts.has(container))return mounts.get(container);
 let view;try{view=new NexusLivingView(container,{quality,onSelect});}catch(e){onError(e);throw e;}
 const api={view,update(raw){try{view.update(validateState(projectState(raw)));return true;}catch(e){view.setConnection('Integrasi state perlu diperiksa');onError(e);return false;}},setActive:v=>view.setActive(v),setTime:v=>view.setTime(v),setMotion:v=>view.setMotion(v),home:v=>view.home(v),setFacts:v=>view.setFacts(v),disconnect:()=>view.setConnection('Koneksi terputus · state terakhir'),
 setParticles:v=>view.setParticles(v),setAmbient:v=>view.setAmbient(v),setSpeed:v=>view.setSpeed(v),setZoomLevel:v=>view.setZoomLevel(v),setHover:v=>view.setHover(v),setFollow:v=>view.setFollow(v),focusAgent:v=>view.focusAgent(v),select:v=>view.select(v),stats:()=>view.stats(),
 dispose(){view.dispose();mounts.delete(container);}};
 mounts.set(container,api);return api;
}
