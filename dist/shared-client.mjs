import {request,send,escapeHTML as esc,editLink} from './shared-api.mjs';
export class SharedEditor{
 static async open(id){
  const session=await request('/api/session');
  const doc=await request('/api/drafts/'+encodeURIComponent(id));
  if(doc.archived)throw new Error('This layout is archived. Restore it from Shared layouts first.');
  return new SharedEditor(id,doc,session.user);
 }
 constructor(id,doc,user){
  this.id=id;this.user=user;this.project={version:2,active:id,layouts:[doc.layout],library:doc.library||[],sketchInstalled:true};
  this.known=new Map([[id,{revision:doc.revision,fingerprint:this.fingerprint(doc.layout,doc.library||[])}]]);
  const prefix='gym-shared-recovery:'+encodeURIComponent(user.email)+':'+id+':';
  this.key=prefix+crypto.randomUUID();this.pending=null;this.retrySnapshot=null;this.running=false;this.blocked=false;this.timer=null;this.status='Saved to shared workspace';this.recovery=null;
  try{
   for(let n=0;n<localStorage.length;n++){
    const key=localStorage.key(n);
    if(!key?.startsWith(prefix))continue;
    let recovery;
    try{recovery=JSON.parse(localStorage.getItem(key));}catch{continue;}
    if(recovery?.project&&!recovery.ignored&&(!this.recovery||recovery.savedAt>this.recovery.savedAt)){
     this.recovery=recovery;this.recoveryKey=key;
    }
   }
  }catch{}
  this.recoveryPending=!!this.recovery?.project;this.recoveryAttempt=null;this.recovering=false;
  window.addEventListener('online',()=>{if(!this.blocked)this.flush();});
  window.addEventListener('beforeunload',e=>{if(this.pending||this.running||this.recovering){e.preventDefault();e.returnValue='';}});
 }
 fingerprint(layout,library){return JSON.stringify({layout,library});}
 report(message){this.status=message+(this.recoveryUnavailable&&(this.pending||this.running||this.blocked)?' Browser recovery is unavailable; export JSON before leaving.':'');this.onStatus?.(this.status);}
 queue(project){
  if(this.recoveryPending)return;
  const changed=project.layouts.some(l=>this.known.get(l.id)?.fingerprint!==this.fingerprint(l,project.library||[]));
  if(!changed&&!this.pending&&!this.running){this.report('Saved to shared workspace');return;}
  this.pending=structuredClone(project);
  try{localStorage.setItem(this.key,JSON.stringify({project:this.pending,revisions:Object.fromEntries([...this.known].map(([id,v])=>[id,v.revision])),savedAt:new Date().toISOString()}));this.recoveryUnavailable=false;}
  catch{this.recoveryUnavailable=true;}
  if(this.recoveryAttempt){this.report('Finish saving the separate recovery copy.');return;}
  if(this.blocked){this.report('Automatic save paused. Your changes are kept in this tab and recovery storage.');return;}
  this.report('Waiting to save');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),400);
 }
 async flush(){
  if(this.running||this.blocked||this.recoveryPending||this.recoveryAttempt||!this.pending)return;
  clearTimeout(this.timer);this.running=true;
  try{
   while(this.pending){
    // Resolve a possibly committed write before sending a newer edit against its revision.
    const snapshot=this.retrySnapshot??this.pending;
    if(snapshot===this.pending)this.pending=null;
    this.retrySnapshot=null;
    this.report('Saving to shared workspace');
    try{
     for(const layout of snapshot.layouts){
      const known=this.known.get(layout.id),fingerprint=this.fingerprint(layout,snapshot.library||[]);
      if(known?.fingerprint===fingerprint)continue;
      const result=await send('/api/drafts'+(known?'/'+encodeURIComponent(layout.id):''),{layout,library:snapshot.library||[],...(known?{expectedRevision:known.revision}:{})},known?'PUT':'POST');
      this.known.set(layout.id,{revision:result.revision,fingerprint});
     }
    }catch(e){
     this.pending??=snapshot;
     if(e.status===undefined||e.status>=500)this.retrySnapshot=snapshot;
     throw e;
    }
   }
   try{localStorage.removeItem(this.key);}catch{}
   this.report('Saved to shared workspace');
  }catch(e){
   if(e.status===409){this.blocked=true;this.report('Save conflict. Save your recovery as a separate draft or reload the shared version.');}
   else this.report('Not saved to shared workspace. '+e.message+' Retry when connected.');
  }finally{this.running=false;this.onStatus?.(this.status);}
 }
 async saveRecovery(project){
  if(this.running||this.recovering)throw new Error('Wait for the current save to finish.');
  clearTimeout(this.timer);
  // An uncertain import must retry the same project with the same request ID.
  const attempt=this.recoveryAttempt??={
   project:structuredClone(this.recoveryPending?this.recovery.project:project),
   requestId:crypto.randomUUID(),pending:this.pending
  };
  this.recovering=true;this.report('Saving separate recovery drafts');
  try{
   const result=await send('/api/import',{project:attempt.project,requestId:attempt.requestId});
   const newerEdits=this.pending!==attempt.pending;
   this.recoveryAttempt=null;this.retrySnapshot=null;this.blocked=newerEdits;this.recoveryPending=false;
   if(!newerEdits)this.pending=null;
   try{
    if(!newerEdits)localStorage.removeItem(this.key);
    if(this.recoveryKey&&localStorage.getItem(this.recoveryKey)===JSON.stringify(this.recovery))localStorage.removeItem(this.recoveryKey);
   }catch{}
   return {...result,newerEdits};
  }catch(e){
   if(e.status>=400&&e.status<500)this.recoveryAttempt=null;
   throw e;
  }finally{this.recovering=false;this.onStatus?.(this.status);}
 }
}
export function bindSharedEditor(cloud,{getProject}){
 document.body.classList.add('shared-mode');
 const banner=document.createElement('div');banner.className='shared-editor-banner';
 banner.innerHTML='<a href="workspace.html">Shared layouts</a><a href="map.html">Current gym map</a><p>This is a draft. Publish from Shared layouts when it matches the physical gym.</p><button id="retryShared">Save now</button><button id="saveSharedRecovery">Save recovery as separate drafts</button><button id="reloadShared">Reload shared version</button><div id="sharedRecovery" hidden><p>Unsaved work from an earlier visit is available. Keep it as separate drafts or continue with the latest shared version.</p><button id="keepRecovered">Keep recovery as separate drafts</button><button id="useShared">Use latest shared version</button></div>';
 document.querySelector('.topbar').after(banner);
 const $=id=>document.getElementById(id);
 cloud.onStatus=message=>{
  $('saveStatus').textContent=message;$('saveSharedRecovery').hidden=!cloud.pending&&!cloud.blocked;
  $('saveSharedRecovery').disabled=$('keepRecovered').disabled=cloud.running||cloud.recovering;
  $('retryShared').disabled=cloud.running||cloud.blocked||!!cloud.recoveryAttempt;
  $('useShared').disabled=!!cloud.recoveryAttempt;
 };
 $('retryShared').onclick=()=>cloud.flush();
 const save=async()=>{
  try{
   const r=await cloud.saveRecovery(getProject());
   if(r.newerEdits){cloud.report('Saved the recovery copy. Newer edits are still in this tab. Save them as separate drafts.');return;}
   location.href=r.imported.length===1?editLink(r.imported[0].id):'workspace.html';
  }catch(e){cloud.report(e.message);}
 };
 $('saveSharedRecovery').onclick=save;$('keepRecovered').onclick=save;
 $('reloadShared').onclick=()=>location.reload();
 if(cloud.recoveryPending){$('sharedRecovery').hidden=false;document.querySelector('.workspace').inert=true;}
 $('useShared').onclick=()=>{
  try{if(cloud.recoveryKey&&localStorage.getItem(cloud.recoveryKey)===JSON.stringify(cloud.recovery))localStorage.setItem(cloud.recoveryKey,JSON.stringify({...cloud.recovery,ignored:true}));}catch{}
  cloud.recoveryPending=false;cloud.recovery=null;$('sharedRecovery').hidden=true;document.querySelector('.workspace').inert=false;cloud.report('Saved to shared workspace');
 };
 document.querySelector('.draft-badge').textContent='SHARED DRAFT';
 document.querySelector('.autosave-note').textContent='Changes save to the shared staff workspace.';
 $('importBtn').onclick=()=>{location.href='workspace.html';};
 $('blankBtn').hidden=true;
 $('confirmDeleteLayout').onclick=()=>{$('deleteLayoutDialog').close();cloud.report('Archive shared layouts from Shared layouts.');};
 cloud.report(cloud.status);
}

