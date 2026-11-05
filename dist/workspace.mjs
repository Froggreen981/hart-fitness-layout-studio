import {buildingPlan} from './building-plan.mjs';
import {request,send,escapeHTML as esc,editLink} from './shared-api.mjs';
const $=id=>document.getElementById(id),when=v=>new Date(v).toLocaleString();
let user,current=null,drafts=[],draftOffset=null,historyOffset=null,publishAction=null,nameAction=null;
function notice(message){$('notice').textContent=message;}
function error(e){notice(e.message);if(e.status===409)notice(e.message+' Refresh the workspace before retrying.');}
async function loadDrafts(append=false){
 const p=new URLSearchParams({archived:$('showArchived').checked?'true':'false',offset:String(append?draftOffset:0)});
 const data=await request('/api/drafts?'+p);current=data.current;draftOffset=data.nextOffset;drafts=append?[...drafts,...data.drafts]:data.drafts;
 $('draftRows').innerHTML=drafts.map(d=>'<tr><td><strong>'+esc(d.name)+'</strong></td><td>'+esc(when(d.updatedAt))+'</td><td>'+d.revision+'</td><td><div class="actions">'+(!d.archived?'<a class="button" href="'+editLink(d.id)+'">Open draft</a><button data-action="rename" data-id="'+esc(d.id)+'">Rename</button>':'')+'<button data-action="duplicate" data-id="'+esc(d.id)+'">Duplicate</button>'+(!d.archived&&['owner','publisher'].includes(user.role)?'<button data-action="publish" data-id="'+esc(d.id)+'">Publish</button>':'')+'<button data-action="archive" data-id="'+esc(d.id)+'">'+(d.archived?'Restore draft':'Archive')+'</button></div></td></tr>').join('');
 $('emptyDrafts').hidden=!!drafts.length;$('moreDrafts').hidden=draftOffset===null;
 const publicData=await request('/api/current');
 $('currentName').textContent=publicData.current?.layout.name||'No current layout published';
 $('currentDate').textContent=publicData.current?'Published '+when(publicData.current.publishedAt):'Import and verify a layout, then publish it when it represents the physical gym.';
 $('draftCurrent').disabled=!current;
}
async function loadHistory(append=false){
 const data=await request('/api/history?offset='+(append?historyOffset:0));historyOffset=data.nextOffset;
 const entries=data.history.map(h=>'<li><div>'+esc(when(h.publishedAt))+'<small>'+esc(h.restoredFrom?'Restored historical arrangement':'Published draft revision '+h.sourceRevision)+(h.id===current?.id?' · Current gym':'')+'</small></div>'+(['owner','publisher'].includes(user.role)&&h.id!==current?.id?'<button data-restore="'+esc(h.id)+'">Restore as current</button>':'')+'</li>').join('');
 if(append)$('history').insertAdjacentHTML('beforeend',entries);else $('history').innerHTML=entries;
 $('emptyHistory').hidden=!!$('history').children.length;$('moreHistory').hidden=historyOffset===null;
}
async function loadStaff(){
 if(user.role!=='owner')return;$('staffSection').hidden=false;
 const data=await request('/api/staff');$('staffList').innerHTML=data.staff.map(s=>'<li>'+esc(s.email)+' · '+esc(s.role)+' <button data-remove-staff="'+esc(s.email)+'">Remove access</button></li>').join('');
}
async function refresh(){await loadDrafts();await loadHistory();}
async function importProject(project,requestId=crypto.randomUUID()){
 const result=await send('/api/import',{project,requestId});notice(result.imported.length+' layouts imported as new shared drafts. Existing layouts were preserved.');await refresh();
}
function beginPublish(action){
 publishAction={...action,expectedCurrentId:current?.id||null,requestId:crypto.randomUUID()};
 $('publishTitle').textContent=action.restore?'Restore as current gym':'Publish as current gym';
 $('publishDescription').textContent=action.restore?'The selected historical arrangement will become current. A new publication will be added.':action.name+' will replace the published current map. Further draft edits will stay unpublished.';
 $('publishError').textContent='';$('confirmActual').checked=false;$('publishDialog').showModal();
}
$('draftRows').onclick=async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;b.disabled=true;
 try{const d=drafts.find(x=>x.id===b.dataset.id);
 if(b.dataset.action==='archive'){await send('/api/drafts/'+d.id+'/archive',{expectedRevision:d.revision,archived:!d.archived});await refresh();return;}
 if(b.dataset.action==='publish'){beginPublish({id:d.id,expectedRevision:d.revision,name:d.name});return;}
 const doc=await request('/api/drafts/'+d.id);nameAction={type:b.dataset.action,doc};
 $('nameTitle').textContent=b.dataset.action==='rename'?'Rename draft':'Duplicate layout';
 $('newName').value=(doc.layout.name+(b.dataset.action==='duplicate'?' copy':'')).slice(0,100);$('nameError').textContent='';$('nameDialog').showModal();
 }catch(err){error(err);}finally{b.disabled=false;}
};
$('nameForm').onsubmit=async e=>{e.preventDefault();$('saveName').disabled=true;
 try{const {type,doc}=nameAction;const name=$('newName').value.trim();if(!name)throw new Error('Enter a name.');
 const layout={...doc.layout,name,...(type==='duplicate'?{id:crypto.randomUUID()}:{})};
 if(type==='duplicate')await send('/api/drafts',{layout,library:doc.library});else await send('/api/drafts/'+layout.id,{layout,library:doc.library,expectedRevision:doc.revision},'PUT');
 $('nameDialog').close();await refresh();notice(type==='duplicate'?'Shared draft created.':'Draft renamed.');
 }catch(err){$('nameError').textContent=err.message;}finally{$('saveName').disabled=false;}
};
$('cancelName').onclick=()=>$('nameDialog').close();
$('history').onclick=e=>{const b=e.target.closest('[data-restore]');if(b)beginPublish({restore:b.dataset.restore});};
$('cancelPublish').onclick=()=>$('publishDialog').close();
$('publishForm').onsubmit=async e=>{e.preventDefault();if(!$('confirmActual').checked)return;$('confirmPublish').disabled=true;
 try{const p=publishAction;await send(p.restore?'/api/history/'+p.restore+'/restore':'/api/drafts/'+p.id+'/publish',{requestId:p.requestId,expectedCurrentId:p.expectedCurrentId,expectedRevision:p.expectedRevision,confirmActual:true});$('publishDialog').close();notice('Current gym map updated.');await refresh();}
 catch(err){$('publishError').textContent=err.message;}finally{$('confirmPublish').disabled=false;}
};
$('newDraft').onclick=async()=>{try{const layout={...buildingPlan(),id:crypto.randomUUID(),name:'Hart layout draft'};const doc=await send('/api/drafts',{layout,library:[]});location.href=editLink(doc.layout.id);}catch(err){error(err);}};
$('refresh').onclick=()=>refresh().catch(error);
$('showArchived').onchange=()=>loadDrafts().catch(error);
$('moreDrafts').onclick=()=>loadDrafts(true).catch(error);
$('moreHistory').onclick=()=>loadHistory(true).catch(error);
$('importFile').onclick=()=>$('jsonFile').click();
$('jsonFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>6*1024*1024)throw new Error('Import file must be smaller than 6 MB.');const project=JSON.parse(await file.text());await importProject(project);}catch(err){error(err);}finally{e.target.value='';}};
$('importBrowser').onclick=async()=>{try{const saved=localStorage.getItem('gym-layout-studio-v1');if(!saved)throw new Error('No browser layouts were found at this address. Export JSON from the original planner, then choose Import JSON here.');await importProject(JSON.parse(saved));}catch(err){error(err);}};
$('draftCurrent').onclick=async()=>{try{const result=await send('/api/drafts/from-current',{expectedCurrentId:current.id});location.href=editLink(result.layout.id);}catch(err){error(err);}};
$('staffForm').onsubmit=async e=>{e.preventDefault();try{await send('/api/staff',{email:$('staffEmail').value,role:$('staffRole').value});$('staffEmail').value='';await loadStaff();notice('Staff permission saved. Site visitor access must also allow this person.');}catch(err){error(err);}};
$('staffList').onclick=async e=>{const b=e.target.closest('[data-remove-staff]');if(!b)return;try{await send('/api/staff',{email:b.dataset.removeStaff},'DELETE');await loadStaff();}catch(err){error(err);}};
try{user=(await request('/api/session')).user;$('identity').textContent=user.email;$('workspaceContent').hidden=false;await refresh();await loadStaff();}
catch(err){$('workspaceContent').hidden=true;$('setupError').hidden=false;$('setupMessage').textContent=err.message;$('signin').hidden=err.status!==401;}

