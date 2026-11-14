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
  await page.goto('/model-checklist.html');
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
  await page.goto('/model-checklist.html');
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
  await page.goto('/model-checklist.html');
  await expect(page.locator('#item-CHK-001 .reference-change')).toContainText('catalog model changed');
  expect((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key))['CHK-001'].correct).toBe('OLDER-MODEL');
  await page.locator('#item-CHK-001').getByRole('radio',{name:'No',exact:true}).check();
  await expect(page.locator('#item-CHK-001 .reference-change')).toBeHidden();
});

test('blocked browser storage warns and still permits checks and backup export',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Test storage disabled');};});
  await page.goto('/model-checklist.html');
  await expect(page.locator('#storage-status')).toBeVisible();
  await page.locator('#item-CHK-001').getByRole('radio',{name:'Yes',exact:true}).check();
  await expect(page.locator('#progress')).toHaveText('1 / 95 checked');
  const wait=page.waitForEvent('download');await page.locator('#backup').click();
  const backup=JSON.parse(await downloadText(await wait));expect(backup.records['CHK-001'].answer).toBe('yes');
});
