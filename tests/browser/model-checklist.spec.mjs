import {test,expect} from '@playwright/test';

const key='hart-model-check-v2';
async function downloadText(download){
  const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('phone checklist retains existing progress and uses the shared catalog quantities and IDs',async({page})=>{
  const mutations=[];page.on('request',request=>{if(request.method()!=='GET')mutations.push(request.url());});
  await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({
    'CHK-001':{answer:'yes',correct:'RSL0620',updated:'2026-11-13T12:00:00Z'}
  })),{key});
  await page.goto('/equipment-checklist.html');
  await expect(page.locator('.card')).toHaveCount(95);
  await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  await expect(page.locator('#item-CHK-073')).toContainText('4 unit(s)');
  await expect(page.locator('#item-CHK-073')).toContainText('HART-0155');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'No',exact:true}).check();
  await page.locator('#correct-CHK-001').fill('Observed-123');
  await page.locator('#item-CHK-002').getByRole('radio',{name:'Can’t find',exact:true}).check();
  await expect(page.locator('#progress')).toHaveText('2 / 95 checked');
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  expect(saved['CHK-001'].correct).toBe('OBSERVED-123');
  expect(saved['CHK-002'].answer).toBe('unknown');
  await page.locator('#search').fill('HART-0155');
  await expect(page.locator('.card:visible')).toHaveCount(1);
  await expect(page.locator('#item-CHK-073')).toBeVisible();
  expect(mutations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('answers survive reload and JSON/CSV exports restore without touching shared layouts',async({page})=>{
  await page.goto('/equipment-checklist.html');
  await page.locator('#item-CHK-094').getByRole('radio',{name:'Can’t find',exact:true}).check();
  await page.reload();await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  const backupWait=page.waitForEvent('download');await page.locator('#backup').click();
  const text=await downloadText(await backupWait),backup=JSON.parse(text);
  expect(backup.format).toBe(key);expect(backup.records['CHK-094'].answer).toBe('unknown');
  page.on('dialog',dialog=>dialog.accept());await page.locator('#reset').click();
  await expect(page.locator('#progress')).toHaveText('0 / 95 checked');
  await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"wrong"}')});
  await expect(page.locator('#notice')).toContainText('Restore failed');
  await page.locator('#import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(text)});
  await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  await expect(page.locator('#notice')).toContainText('No shared drafts or catalog records were changed');
  const csvWait=page.waitForEvent('download');await page.locator('#export').click();
  const csv=await downloadText(await csvWait);expect(csv).toContain('Model not found');expect(csv).toContain('HART-0155');
});

test('old model observations are preserved and flagged when the catalog reference changes',async({page})=>{
  await page.addInitScript(({key})=>localStorage.setItem(key,JSON.stringify({
    'CHK-001':{answer:'yes',correct:'OLDER-MODEL',updated:'2026-11-01T12:00:00Z'}
  })),{key});
  await page.goto('/equipment-checklist.html');
  await expect(page.locator('#item-CHK-001 .reference-change')).toContainText('catalog model changed');
  expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key))['CHK-001'].correct).toBe('OLDER-MODEL');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'No',exact:true}).check();
  await expect(page.locator('#item-CHK-001 .reference-change')).toBeHidden();
});

test('blocked browser storage warns and still permits checks and backup export',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Test storage disabled');};});
  await page.goto('/equipment-checklist.html');
  await expect(page.locator('#storage-status')).toBeVisible();
  await page.locator('#item-CHK-001').getByRole('radio',{name:'Yes',exact:true}).check();
  await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  const wait=page.waitForEvent('download');await page.locator('#backup').click();
  const backup=JSON.parse(await downloadText(await wait));expect(backup.records['CHK-001'].answer).toBe('yes');
});

test('survey filters expose mismatches, uncertain references and an exportable group summary',async({page})=>{
  await page.goto('/equipment-checklist.html');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'No',exact:true}).check();
  await page.locator('#correct-CHK-001').fill('OBSERVED-ONLY');
  await page.locator('#item-CHK-094').getByRole('radio',{name:'Can’t find',exact:true}).check();
  await page.locator('#observation-filter').selectOption('mismatch');
  await expect(page.locator('.card:visible')).toHaveCount(1);await expect(page.locator('#item-CHK-001')).toBeVisible();
  await page.locator('#observation-filter').selectOption('unknown');
  await expect(page.locator('.card:visible')).toHaveCount(1);await expect(page.locator('#item-CHK-094')).toBeVisible();
  await page.locator('#observation-filter').selectOption('');
  await page.locator('#confidence-filter').selectOption('reported');
  await expect(page.locator('#item-CHK-073')).toBeVisible();await expect(page.locator('#item-CHK-001')).toBeHidden();
  await page.locator('#confidence-filter').selectOption('');
  await page.locator('#missing-dimensions').check();
  await expect(page.locator('#item-CHK-094')).toBeVisible();
  await page.locator('.survey-summary summary').click();
  await expect(page.locator('#survey-totals')).toContainText('2 / 95 groups observed');
  const wait=page.waitForEvent('download');await page.locator('#report').click();
  const report=JSON.parse(await downloadText(await wait));
  expect(report.format).toBe('hart-survey-report-v1');expect(report.summary.observedGroups).toBe(2);
  expect(report.summary.units).toBe(155);expect(report.outstanding.some(item=>item.catalogId==='CHK-001')).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('a clear and a restore each retain a recoverable previous checklist across reloads',async({page})=>{
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/equipment-checklist.html');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'No',exact:true}).check();
  await page.locator('#correct-CHK-001').fill('KEEP-ME');
  await page.locator('#reset').click();await expect(page.locator('#progress')).toHaveText('0 / 95 checked');
  await page.reload();await page.locator('#undo-replace').click();
  await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  await expect(page.locator('#correct-CHK-001')).toHaveValue('KEEP-ME');
  const backup={format:key,records:{'CHK-094':{answer:'unknown',correct:''}}};
  await page.locator('#import').setInputFiles({name:'replacement.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('#notice')).toContainText('Checklist backup restored');
  await page.reload();await page.locator('#undo-replace').click();
  await expect(page.locator('#correct-CHK-001')).toHaveValue('KEEP-ME');
  const records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  expect(Object.keys(records)).toEqual(['CHK-001']);
});

test('two checklist tabs retain unrelated observations and notify about external changes',async({page,context})=>{
  await page.goto('/equipment-checklist.html');const other=await context.newPage();await other.goto('/equipment-checklist.html');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'Yes',exact:true}).check();
  await expect(other.locator('#progress')).toHaveText('1 / 95 checked');
  await expect(other.locator('#notice')).toContainText('Another tab changed');
  await other.locator('#item-CHK-002').getByRole('radio',{name:'Can’t find',exact:true}).check();
  await expect(page.locator('#progress')).toHaveText('2 / 95 checked');
  await page.reload();await expect(page.locator('#progress')).toHaveText('2 / 95 checked');
  const records=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  expect(records['CHK-001'].answer).toBe('yes');expect(records['CHK-002'].answer).toBe('unknown');
});

test('failed recovery storage prevents destructive checklist replacement',async({page})=>{
  await page.addInitScript(()=>{
    const set=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(key==='hart-model-check-v2:before-replace')throw new Error('Fixture quota failure');return set.call(this,key,value);};
  });
  page.on('dialog',dialog=>dialog.accept());await page.goto('/equipment-checklist.html');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'Yes',exact:true}).check();
  await page.locator('#reset').click();
  await expect(page.locator('#storage-status')).toContainText('No checks changed');
  await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  await page.reload();await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
});
