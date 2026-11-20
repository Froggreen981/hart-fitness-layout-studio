import {equipmentCatalog} from './equipment-catalog.mjs';
import {CHECKLIST_KEY,CHECKLIST_RECOVERY_KEY,checklistRecords,checklistBackup,checklistProgress,checklistCSV,checklistReferenceChanged,checklistFollowUp,checklistReport} from './model-checklist.mjs';
import {escapeHTML as esc} from './shared-api.mjs';

const $=id=>document.getElementById(id);
let records=Object.create(null),storageOK=true,lastStored=null,previous=null;
const groups=[...new Set(equipmentCatalog.map(item=>item.area))];
$('areas').innerHTML=groups.map((area,index)=>'<section class="area" id="area-'+index+'"><h2>'+esc(area)+'</h2>'+equipmentCatalog.filter(item=>item.area===area).map(item=>{
  const choices=item.modelNumber?['yes','no','unknown']:['unknown'];
  return '<article class="card" id="item-'+item.id+'" data-id="'+item.id+'" data-status="unchecked">'+
    '<div class="card-top"><span class="check-id">'+item.id+'</span><span class="status" aria-live="polite">Not checked</span></div>'+
    '<h3>'+esc(item.name)+'</h3><p class="brand">'+esc(item.manufacturer)+' · '+item.quantity+' unit(s) · '+esc(item.modelStatus)+'</p>'+
    '<p class="fine">Physical IDs: '+esc(item.inventoryIds.join(', '))+'</p>'+
    (item.modelNumber?'<div class="suspect"><span>Catalog model</span><strong>'+esc(item.modelNumber)+'</strong></div>':'<p class="no-code">No model number identified yet</p>')+
    '<fieldset class="answers"><legend class="fine">'+(item.modelNumber?'Does the catalog model match?':'Model identification')+'</legend>'+choices.map(answer=>'<label class="choice"><input type="radio" name="answer-'+item.id+'" value="'+answer+'"><span>'+({yes:'Yes',no:'No',unknown:'Can’t find'})[answer]+'</span></label>').join('')+'</fieldset>'+
    '<div class="correction" '+(item.modelNumber?'data-conditional':'')+'><label for="correct-'+item.id+'">'+(item.modelNumber?'Correct model number if No':'Model number observed')+'</label><input type="text" id="correct-'+item.id+'" maxlength="100" autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false">'+
    (item.modelCandidates.length?'<div class="alts">Other candidates: '+item.modelCandidates.filter(code=>code!==item.modelNumber).map(code=>'<button type="button" class="alt" data-alternative="'+esc(code)+'">'+esc(code)+'</button>').join('')+'</div>':'')+'</div>'+
    '<p class="reference-change warning" hidden></p>'+
    (item.dimensionsIn?'<p class="fine"><a href="'+esc(item.dimensionsIn.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Manufacturer specifications</a>: '+esc(item.dimensionsIn.length+' × '+item.dimensionsIn.width+' in (L × W)')+'. Confirm actual model and footprint on site.</p>':'')+'</article>';
}).join('')+'</section>').join('');
$('area-filter').innerHTML='<option value="">All areas</option>'+groups.map(area=>'<option>'+esc(area)+'</option>').join('');

function warning(message){$('storage-status').hidden=false;$('storage-status').textContent=message;}
try{
  const stored=localStorage.getItem(CHECKLIST_KEY);
  if(stored)records=checklistRecords(JSON.parse(stored));
  lastStored=stored;
  localStorage.setItem(CHECKLIST_KEY+':probe','ok');localStorage.removeItem(CHECKLIST_KEY+':probe');
}catch{
  storageOK=false;warning('Browser progress could not be read or saved. Existing saved data was left untouched. Export your current answers before leaving.');
}
try{const stored=localStorage.getItem(CHECKLIST_RECOVERY_KEY);if(stored)previous=checklistBackup(JSON.parse(stored));}catch{/* Retain a corrupt recovery value without affecting current progress. */}
$('undo-replace').hidden=!previous;

function paint(item){
  const card=$('item-'+item.id),record=records[item.id]||{},answer=record.answer;
  card.dataset.status=answer==='yes'?'yes':answer==='no'||answer==='identified'?'no':answer==='unknown'?'unknown':'unchecked';
  card.querySelector('.status').textContent=answer==='yes'?'Yes · matches':answer==='no'?(record.correct?'No · corrected':'No · needs model'):answer==='identified'?'Model recorded':answer==='unknown'?'Model not found':'Not checked';
  for(const radio of card.querySelectorAll('input[type="radio"]'))radio.checked=radio.value===answer;
  const input=card.querySelector('input[type="text"]');if(input!==document.activeElement)input.value=record.correct||'';
  const reference=record.modelAtCheck??(answer==='yes'?record.correct:null);
  const changed=checklistReferenceChanged(item,record);
  const note=card.querySelector('.reference-change');note.hidden=!changed;
  note.textContent=changed?'The catalog model changed since this check ('+(reference||'unidentified')+'). Recheck before applying this observation.':'';
}
function filter(){
  const query=$('search').value.trim().toLowerCase(),area=$('area-filter').value,unchecked=$('unchecked').checked;
  const observation=$('observation-filter').value,confidence=$('confidence-filter').value,missingDimensions=$('missing-dimensions').checked;
  let visible=0;
  for(const item of equipmentCatalog){
    const record=records[item.id];
    const observationMatch=!observation||observation==='follow-up'&&checklistFollowUp(item,record)||
      observation==='mismatch'&&['no','identified'].includes(record?.answer)||
      observation==='unknown'&&record?.answer==='unknown'||observation==='changed'&&checklistReferenceChanged(item,record);
    const matches=(!area||item.area===area)&&(!unchecked||!record)&&observationMatch&&
      (!confidence||item.modelStatus===confidence)&&(!missingDimensions||!item.dimensionsIn)&&
      (!query||[item.id,item.name,item.manufacturer,item.modelNumber,...item.inventoryIds].join(' ').toLowerCase().includes(query));
    $('item-'+item.id).hidden=!matches;if(matches)visible++;
  }
  for(const section of document.querySelectorAll('.area'))section.hidden=![...section.querySelectorAll('.card')].some(card=>!card.hidden);
  $('no-results').hidden=visible>0;
}
function progress(){
  const p=checklistProgress(records);
  $('progress').textContent=p.checked+' / '+equipmentCatalog.length+' checked';
  $('details').textContent=p.yes+' Yes · '+p.no+' No · '+p.unknown+' Can’t find';
  $('fill').style.width=p.checked*100/equipmentCatalog.length+'%';
  $('progressbar').setAttribute('aria-valuenow',p.checked);filter();
  const report=checklistReport(records),s=report.summary;
  $('survey-totals').textContent=s.observedGroups+' / '+s.groups+' groups observed · '+s.unitsInObservedGroups+' / '+s.units+' units in those groups · '+s.followUpGroups+' groups need follow-up · '+s.groupsWithoutSourceDimensions+' lack source dimensions';
  $('area-progress').innerHTML=report.areas.map(area=>'<li>'+esc(area.area)+': '+area.observedGroups+' / '+area.groups+' groups observed; '+area.followUpGroups+' need follow-up</li>').join('');
}
function syncRecords(){
  if(!storageOK)return;
  try{
    const stored=localStorage.getItem(CHECKLIST_KEY);if(stored===lastStored)return;
    const next=stored?checklistRecords(JSON.parse(stored)):Object.create(null);
    records=next;lastStored=stored;for(const item of equipmentCatalog)paint(item);
    $('notice').textContent='Another tab changed this checklist. Latest saved observations loaded; review changes before continuing.';progress();
  }catch{storageOK=false;warning('Another saved checklist could not be read. Existing data was left untouched. Export your answers before leaving.');}
}
addEventListener('storage',event=>{
  if(event.key===CHECKLIST_KEY||event.key===null)syncRecords();
  if(event.key===CHECKLIST_RECOVERY_KEY||event.key===null)try{
    const stored=localStorage.getItem(CHECKLIST_RECOVERY_KEY);previous=stored?checklistBackup(JSON.parse(stored)):null;
    $('undo-replace').hidden=!previous;
  }catch{/* Keep the current in-memory recovery copy if another tab wrote invalid data. */}
});
function save(){
  if(storageOK)try{const value=JSON.stringify(records);localStorage.setItem(CHECKLIST_KEY,value);lastStored=value;$('saveinfo').textContent='Saved on this browser. Export a backup to transfer your progress.';}
  catch{storageOK=false;warning('Browser saving is unavailable. Export your answers before leaving.');}
  progress();
}
function record(item,answer,correct){
  syncRecords();
  records[item.id]={answer,correct,updated:new Date().toISOString(),modelAtCheck:item.modelNumber||''};
  paint(item);save();
}
$('areas').addEventListener('change',event=>{
  if(event.target.type!=='radio')return;
  const id=event.target.closest('.card').dataset.id,item=equipmentCatalog.find(item=>item.id===id),answer=event.target.value;
  record(item,answer,answer==='yes'?item.modelNumber:answer==='no'&&records[id]?.answer==='no'?records[id].correct:'');
});
$('areas').addEventListener('input',event=>{
  if(event.target.type!=='text')return;
  const id=event.target.closest('.card').dataset.id,item=equipmentCatalog.find(item=>item.id===id);
  if(!item.modelNumber&&!event.target.value.trim()){syncRecords();delete records[id];paint(item);save();return;}
  record(item,item.modelNumber?'no':'identified',event.target.value.toUpperCase());
});
$('areas').addEventListener('click',event=>{
  const button=event.target.closest('[data-alternative]');if(!button)return;
  const item=equipmentCatalog.find(item=>item.id===button.closest('.card').dataset.id);
  record(item,'no',button.dataset.alternative);
});
$('search').oninput=filter;$('area-filter').onchange=filter;$('unchecked').onchange=filter;
for(const id of ['observation-filter','confidence-filter','missing-dimensions'])$(id).onchange=filter;

function download(filename,data,mime){
  const url=URL.createObjectURL(new Blob([data],{type:mime})),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
const today=()=>new Date().toISOString().slice(0,10);
$('export').onclick=()=>download('Hart-Model-Checks-'+today()+'.csv',checklistCSV(records),'text/csv;charset=utf-8');
$('backup').onclick=()=>download('Hart-Model-Backup-'+today()+'.json',JSON.stringify({format:CHECKLIST_KEY,records},null,2),'application/json');
$('report').onclick=()=>download('Hart-Survey-Report-'+today()+'.json',JSON.stringify({...checklistReport(records),createdAt:new Date().toISOString()},null,2),'application/json');
function replaceRecords(next){
  syncRecords();
  if(!storageOK){warning('Browser storage is unavailable. No checks changed. Download a JSON backup before leaving.');return false;}
  const before=checklistRecords(records);
  try{localStorage.setItem(CHECKLIST_RECOVERY_KEY,JSON.stringify({format:CHECKLIST_KEY,records:before}));}
  catch{warning('Previous checks could not be preserved. No checks changed. Download a JSON backup before clearing or restoring.');return false;}
  previous=before;
  records=next;for(const item of equipmentCatalog)paint(item);save();$('undo-replace').hidden=false;
  return true;
}
$('restore').onclick=()=>$('import').click();
$('import').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>256*1024)throw Error('Checklist backups must be smaller than 256 KB.');
    const restored=checklistBackup(JSON.parse(await file.text()));
    if(!confirm('Replace the checklist on this browser with the backup?'))return;
    if(replaceRecords(restored))$('notice').textContent='Checklist backup restored. Previous checks can be recovered below. No shared drafts or catalog records were changed.';
  }catch(error){$('notice').textContent='Restore failed: '+error.message;}
  finally{event.target.value='';}
};
$('reset').onclick=()=>{
  if(!confirm('Clear all 95 checks on this browser? Export a backup first.'))return;
  replaceRecords(Object.create(null));
};
$('undo-replace').onclick=()=>{
  if(!previous||!confirm('Recover the checklist before the last clear or restore? The current checklist will become the recovery copy.'))return;
  const recovered=previous;if(replaceRecords(recovered))$('notice').textContent='Previous checklist recovered. No shared drafts or catalog records were changed.';
};
for(const item of equipmentCatalog)paint(item);progress();
