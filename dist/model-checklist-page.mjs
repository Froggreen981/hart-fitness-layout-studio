import {equipmentCatalog} from './equipment-catalog.mjs';
import {CHECKLIST_KEY,checklistRecords,checklistBackup,checklistProgress,checklistCSV} from './model-checklist.mjs';
import {escapeHTML as esc} from './shared-api.mjs';

const $=id=>document.getElementById(id);
let records=Object.create(null),storageOK=true;
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
  localStorage.setItem(CHECKLIST_KEY+':probe','ok');localStorage.removeItem(CHECKLIST_KEY+':probe');
}catch{
  storageOK=false;warning('Browser progress could not be read or saved. Existing saved data was left untouched. Export your current answers before leaving.');
}

function paint(item){
  const card=$('item-'+item.id),record=records[item.id]||{},answer=record.answer;
  card.dataset.status=answer==='yes'?'yes':answer==='no'||answer==='identified'?'no':answer==='unknown'?'unknown':'unchecked';
  card.querySelector('.status').textContent=answer==='yes'?'Yes · matches':answer==='no'?(record.correct?'No · corrected':'No · needs model'):answer==='identified'?'Model recorded':answer==='unknown'?'Model not found':'Not checked';
  for(const radio of card.querySelectorAll('input[type="radio"]'))radio.checked=radio.value===answer;
  const input=card.querySelector('input[type="text"]');if(input!==document.activeElement)input.value=record.correct||'';
  const reference=record.modelAtCheck??(answer==='yes'?record.correct:null);
  const changed=reference!==null&&reference!==undefined&&reference!==(item.modelNumber||'');
  const note=card.querySelector('.reference-change');note.hidden=!changed;
  note.textContent=changed?'The catalog model changed since this check ('+(reference||'unidentified')+'). Recheck before applying this observation.':'';
}
function filter(){
  const query=$('search').value.trim().toLowerCase(),area=$('area-filter').value,unchecked=$('unchecked').checked;
  let visible=0;
  for(const item of equipmentCatalog){
    const matches=(!area||item.area===area)&&(!unchecked||!records[item.id])&&
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
}
function save(){
  if(storageOK)try{localStorage.setItem(CHECKLIST_KEY,JSON.stringify(records));$('saveinfo').textContent='Saved on this browser. Export a backup to transfer your progress.';}
  catch{storageOK=false;warning('Browser saving is unavailable. Export your answers before leaving.');}
  progress();
}
function record(item,answer,correct){
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
  if(!item.modelNumber&&!event.target.value.trim()){delete records[id];paint(item);save();return;}
  record(item,item.modelNumber?'no':'identified',event.target.value.toUpperCase());
});
$('areas').addEventListener('click',event=>{
  const button=event.target.closest('[data-alternative]');if(!button)return;
  const item=equipmentCatalog.find(item=>item.id===button.closest('.card').dataset.id);
  record(item,'no',button.dataset.alternative);
});
$('search').oninput=filter;$('area-filter').onchange=filter;$('unchecked').onchange=filter;

function download(filename,data,mime){
  const url=URL.createObjectURL(new Blob([data],{type:mime})),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
const today=()=>new Date().toISOString().slice(0,10);
$('export').onclick=()=>download('Hart-Model-Checks-'+today()+'.csv',checklistCSV(records),'text/csv;charset=utf-8');
$('backup').onclick=()=>download('Hart-Model-Backup-'+today()+'.json',JSON.stringify({format:CHECKLIST_KEY,records},null,2),'application/json');
$('restore').onclick=()=>$('import').click();
$('import').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>256*1024)throw Error('Checklist backups must be smaller than 256 KB.');
    const restored=checklistBackup(JSON.parse(await file.text()));
    if(!confirm('Replace the checklist on this browser with the backup?'))return;
    records=restored;for(const item of equipmentCatalog)paint(item);save();$('notice').textContent='Checklist backup restored. No shared drafts or catalog records were changed.';
  }catch(error){$('notice').textContent='Restore failed: '+error.message;}
  finally{event.target.value='';}
};
$('reset').onclick=()=>{
  if(!confirm('Clear all 95 checks on this browser? Export a backup first.'))return;
  records=Object.create(null);for(const item of equipmentCatalog)paint(item);save();
};
for(const item of equipmentCatalog)paint(item);progress();
