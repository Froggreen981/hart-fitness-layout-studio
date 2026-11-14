import {equipmentCatalog,getCatalogRecord} from './equipment-catalog.mjs';

// Preserve the original phone checklist's browser key and JSON backup format.
export const CHECKLIST_KEY='hart-model-check-v2';
const answers=new Set(['yes','no','unknown','identified']);

export function checklistRecords(input,{strict=true}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Checklist records must be an object.');
  const records=Object.create(null);
  for(const [id,record] of Object.entries(input)){
    if(!getCatalogRecord(id))continue;
    const valid=record&&typeof record==='object'&&!Array.isArray(record)&&answers.has(record.answer)&&
      (record.correct===undefined||typeof record.correct==='string'&&record.correct.length<=100)&&
      (record.updated===undefined||typeof record.updated==='string'&&record.updated.length<=50)&&
      (record.modelAtCheck===undefined||typeof record.modelAtCheck==='string'&&record.modelAtCheck.length<=100);
    if(!valid){if(strict)throw Error('Invalid checklist answer for '+id+'.');continue;}
    records[id]={answer:record.answer,correct:record.correct||'',updated:record.updated||'',
      ...(record.modelAtCheck!==undefined?{modelAtCheck:record.modelAtCheck}:{})};
  }
  return records;
}

export function checklistBackup(input){
  if(input?.format!==CHECKLIST_KEY)throw Error('Choose a Hart model checklist v2 backup.');
  return checklistRecords(input.records);
}

export function checklistProgress(records){
  const progress={checked:0,yes:0,no:0,unknown:0};
  for(const entry of equipmentCatalog){
    const answer=records[entry.id]?.answer;
    if(!answers.has(answer))continue;
    progress.checked++;
    progress[answer==='identified'?'no':answer]++;
  }
  return progress;
}

function csvCell(value){
  let text=String(value??'');
  // Quoting alone does not prevent spreadsheet formulas in staff-entered corrections.
  if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}

export function checklistCSV(records){
  const rows=[['Check ID','Area','Manufacturer','Equipment','Quantity','Suspected model','Alternative codes','Verified?','Correct model','Inventory IDs','Checked at']];
  const statuses={yes:'Yes',no:'No',identified:'Model entered',unknown:'Model not found'};
  for(const item of equipmentCatalog){
    const record=records[item.id]||{};
    rows.push([item.id,item.area,item.manufacturer,item.name,item.quantity,item.modelNumber||'',
      item.modelCandidates.join(' | '),statuses[record.answer]||'Not checked',record.correct||'',
      item.inventoryIds.join(', '),record.updated||'']);
  }
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
