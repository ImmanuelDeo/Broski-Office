import {normalizeFrame} from './model.js';
/** Bind only after Hermes has mapped the real /api/state schema. No API calls here. */
export function createPresenter({view,mapState,mapEvents=()=>[]}){
 if(typeof mapState!=='function')throw Error('mapState must map the real Nexus state schema');
 let initialized=false;const seenTasks=new Map();let lastSequence=-Infinity;let previousEvents=new Set();
 return {
  onState(raw,{sequence}={}){
   if(Number.isFinite(sequence)&&sequence<=lastSequence)return false;
   const frame=normalizeFrame(mapState(raw));
   const mappedEvents=mapEvents(raw);if(!Array.isArray(mappedEvents))throw Error('mapEvents must return an array');const events=mappedEvents.slice(-512);
   view.update(frame);
   // First poll establishes a baseline. Do not replay historical memory access.
   if(initialized){for(const e of events)if(!previousEvents.has(e.id))view.knowledge(e);
    for(const a of frame.agents){if(a.taskId&&a.snapshotReady===true&&a.taskId!==seenTasks.get(a.id))view.knowledge({id:'snapshot:'+a.id+':'+a.taskId,agentId:a.id,kind:'snapshot'});}
   }else{for(const e of events)if(typeof e.id==='string')view.sim.eventIds.set(e.id,0);}
   for(const a of frame.agents)seenTasks.set(a.id,a.taskId);
   previousEvents=new Set(events.map(e=>e.id));initialized=true;if(Number.isFinite(sequence))lastSequence=sequence;return true;
  },
  onDisconnected(){view.update({agents:view.sim.workers.map(w=>({id:w.id,status:'unknown',taskId:null})),memoryBytes:null,mode:'live'});},
  dispose(){seenTasks.clear();previousEvents.clear();}
 };
}
/**
 * The original renderer remains available for rollback. The host supplies its
 * real pause/resume methods; no guesses about existing function names or DOM IDs.
 */
export async function mountUpgrade({container,legacyElement,pauseLegacy,resumeLegacy,options={},mapState,mapEvents}){
  if(!container||container===legacyElement)throw Error('Use a separate viewport container');
 if(typeof pauseLegacy!=='function'||typeof resumeLegacy!=='function')throw Error('Supply verified renderer lifecycle hooks');
 const {NexusOfficeView}=await import('./view.js');let view;
 try{
  view=new NexusOfficeView(container,options);console.log('[Nexus-v2] creating presenter...');
  const presenter=createPresenter({view,mapState,mapEvents});
  console.log('[Nexus-v2] presenter created:', presenter);pauseLegacy();if(legacyElement)legacyElement.hidden=true;
  let rolledBack=false;const rollback=()=>{if(rolledBack)return;rolledBack=true;container.removeEventListener('nexus-renderer-lost',rollback);presenter.dispose();view.dispose();container.replaceChildren();if(legacyElement)legacyElement.hidden=false;resumeLegacy();};
  container.addEventListener('nexus-renderer-lost',rollback,{once:true});return {view,presenter,rollback};
 }catch(error){view?.dispose();container.replaceChildren();if(legacyElement)legacyElement.hidden=false;resumeLegacy();throw error;}
}
