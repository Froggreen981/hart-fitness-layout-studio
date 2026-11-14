import {test as base,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {applyCatalogIdentity,getCatalogRecord} from '../../dist/equipment-catalog.mjs';

const test=base.extend({
  page:async({page},use)=>{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await use(page);
    expect(errors,'uncaught application errors').toEqual([]);
  }
});

const bench=()=>applyCatalogIdentity({id:randomUUID(),name:'Test bench',category:'free',kind:'bench',
  width:3,length:5,x:10,y:15,rotation:90,buffer:0,locked:false},getCatalogRecord('CHK-073'),'HART-0104');

async function draft(request,items=[]){
  const layout={id:randomUUID(),name:'TEST ONLY '+randomUUID(),room:{width:60,length:50,areasMigrated:true},items};
  const response=await request.post('/api/drafts',{data:{layout,library:[]}});
  expect(response.ok()).toBeTruthy();
  return (await response.json()).layout;
}
async function read(request,id){
  const response=await request.get('/api/drafts/'+id);
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function current(request){return (await request.get('/api/current')).json();}
async function open(page,id){
  await page.goto('/index.html?draft='+id);
  await expect(page.locator('.draft-badge')).toHaveText('SHARED DRAFT');
}
async function edit(page,selector,value){
  const input=page.locator(selector);
  await input.fill(String(value));
  await input.press('Tab');
}
async function editorContext(browser,request){
  const email='editor-'+randomUUID()+'@example.test';
  expect((await request.post('/api/staff',{data:{email,role:'editor'}})).ok()).toBeTruthy();
  const context=await browser.newContext();
  await context.route('**/api/**',route=>{
    const url=new URL(route.request().url());url.searchParams.set('test_actor',email);
    return route.continue({url:url.href});
  });
  return context;
}

test('catalog dimensions, metadata and equipment edits persist across staff sessions',async({page,request,browser})=>{
  const before=await current(request),layout=await draft(request);
  await open(page,layout.id);
  await page.locator('#catalogAddBtn').click();
  await page.locator('#catalogPick').selectOption('CHK-014');
  await expect(page.locator('#catalogWidth')).toHaveValue('4.833');
  await expect(page.locator('#catalogLength')).toHaveValue('3.167');
  await expect(page.locator('#catalogDimensionSource')).toHaveAttribute('href',getCatalogRecord('CHK-014').dimensionsIn.sourceUrl);
  await expect(page.locator('#catalogExerciseNote')).toContainText('biceps curl');
  await page.locator('#catalogPick').selectOption('');
  await expect(page.locator('#catalogCreateBtn')).toBeDisabled();
  await expect(page.locator('#catalogWidth')).toBeEmpty();
  await expect(page.locator('#catalogDimensionSource')).toBeHidden();
  await page.locator('#catalogPick').selectOption('CHK-014');
  await page.locator('#catalogCreateBtn').click();
  await expect.poll(async()=>(await read(request,layout.id)).layout.items.length).toBe(1);
  await edit(page,'[data-prop="width"]',4.25);
  await edit(page,'[data-prop="x"]',17);
  await edit(page,'[data-catalog-field="exercises"]','biceps curl, reviewed variation');
  await page.getByRole('checkbox',{name:'Out of service'}).check();
  await expect.poll(async()=>(await read(request,layout.id)).layout.items[0].status).toBe('out-of-service');
  const saved=(await read(request,layout.id)).layout.items[0];
  expect(saved).toMatchObject({width:4.25,x:17,inventoryId:'HART-0014',catalogId:'CHK-014',exercises:['biceps curl','reviewed variation']});
  const other=await browser.newContext();
  try{
    const reopened=await other.newPage();await open(reopened,layout.id);
    await expect(reopened.locator('[data-prop="width"]')).toHaveValue('4.25');
    await expect(reopened.locator('[data-prop="x"]')).toHaveValue('17');
    await expect(reopened.locator('[data-catalog-field="exercises"]')).toHaveValue('biceps curl, reviewed variation');
    await expect(reopened.getByRole('checkbox',{name:'Out of service'})).toBeChecked();
  }finally{await other.close();}
  expect(await current(request)).toEqual(before);
});

test('duplicated equipment and saved templates keep model metadata without reusing physical units',async({page,request})=>{
  const layout=await draft(request,[bench()]);await open(page,layout.id);
  await page.locator('[data-action="duplicate"]').click();
  await expect.poll(async()=>(await read(request,layout.id)).layout.items.length).toBe(2);
  await expect(page.locator('[data-catalog-field="inventoryId"]')).toHaveValue('');
  await page.locator('[data-action="save-template"]').click();
  await expect.poll(async()=>(await read(request,layout.id)).library.length).toBe(1);
  await page.locator('#equipmentLibrary [data-template]').last().click();
  await expect.poll(async()=>(await read(request,layout.id)).layout.items.length).toBe(3);
  const items=(await read(request,layout.id)).layout.items;
  expect(items.map(item=>item.inventoryId||'')).toEqual(['HART-0104','','']);
  for(const item of items){expect(item.catalogId).toBe('CHK-073');expect(item.exercises).toEqual(['barbell bench press']);}
  await page.locator('[data-catalog-field="inventoryId"]').selectOption('HART-0105');
  await expect.poll(async()=>(await read(request,layout.id)).layout.items[2].inventoryId).toBe('HART-0105');
  await page.locator('#catalogAddBtn').click();
  await page.locator('#catalogPick').selectOption('CHK-073');
  const choices=await page.locator('#catalogInventoryPick option').evaluateAll(options=>options.map(option=>option.value));
  expect(choices).toEqual(['HART-0154','HART-0155']);
  await page.locator('#catalogCancel').click();
});

test('linking another model preserves geometry and replaces incompatible exercise defaults',async({page,request})=>{
  const unit=bench(),layout=await draft(request,[unit]);await open(page,layout.id);
  await page.locator('#linkedCatalogPick').selectOption('CHK-014');
  await page.getByRole('button',{name:'Apply model and manufacturer'}).click();
  await expect.poll(async()=>(await read(request,layout.id)).layout.items[0].catalogId).toBe('CHK-014');
  const linked=(await read(request,layout.id)).layout.items[0];
  expect(linked).toMatchObject({x:unit.x,y:unit.y,width:unit.width,length:unit.length,rotation:unit.rotation,inventoryId:'',exercises:['biceps curl']});
  await page.locator('[data-catalog-field="inventoryId"]').selectOption('HART-0014');
  await expect.poll(async()=>(await read(request,layout.id)).layout.items[0].inventoryId).toBe('HART-0014');
  await page.reload();
  await expect(page.locator('[data-catalog-field="inventoryId"]')).toHaveValue('HART-0014');
});

test('a stale staff save creates a separate recovery draft without replacing the newer save',async({page,request,browser})=>{
  const layout=await draft(request,[bench()]),other=await editorContext(browser,request);
  try{
    const editor=await other.newPage();await open(page,layout.id);await open(editor,layout.id);
    await edit(page,'[data-prop="x"]',20);
    await expect.poll(async()=>(await read(request,layout.id)).layout.items[0].x).toBe(20);
    await edit(editor,'[data-prop="x"]',30);
    await expect(editor.locator('#saveStatus')).toContainText('Save conflict');
    expect((await read(request,layout.id)).layout.items[0].x).toBe(20);
    await editor.getByRole('button',{name:'Save recovery as separate drafts',exact:true}).click();
    await expect(editor).not.toHaveURL(new RegExp(layout.id));
    const recoveredId=new URL(editor.url()).searchParams.get('draft');
    expect(recoveredId).toBeTruthy();
    expect((await read(request,recoveredId)).layout.items[0].x).toBe(30);
    expect((await read(request,layout.id)).layout.items[0].x).toBe(20);
  }finally{await other.close();}
});

test('offline edits survive closing the tab and recover as an independent draft',async({page,context,request})=>{
  const layout=await draft(request,[bench()]);await open(page,layout.id);
  await context.setOffline(true);
  await edit(page,'[data-prop="x"]',33);
  await expect(page.locator('#saveStatus')).toContainText('Not saved to shared workspace');
  page.on('dialog',dialog=>dialog.accept());await page.close();
  await context.setOffline(false);
  const reopened=await context.newPage();await open(reopened,layout.id);
  await expect(reopened.locator('#sharedRecovery')).toBeVisible();
  await reopened.getByRole('button',{name:'Keep recovery as separate drafts'}).click();
  await expect(reopened).not.toHaveURL(new RegExp(layout.id));
  const recoveredId=new URL(reopened.url()).searchParams.get('draft');
  expect((await read(request,recoveredId)).layout.items[0].x).toBe(33);
  expect((await read(request,layout.id)).layout.items[0].x).toBe(10);
});

test('editor-only staff cannot publish through controls or the API',async({browser,request})=>{
  const layout=await draft(request,[bench()]),before=await current(request),context=await editorContext(browser,request);
  try{
    const editor=await context.newPage();await editor.goto('/workspace.html');
    await expect(editor.locator('#draftRows')).toContainText(layout.name);
    await expect(editor.getByRole('button',{name:'Publish',exact:true})).toHaveCount(0);
    await expect(editor.locator('#staffSection')).toBeHidden();
    const status=await editor.evaluate(async id=>(await fetch('/api/drafts/'+id+'/publish',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({requestId:crypto.randomUUID(),expectedRevision:1,expectedCurrentId:null,confirmActual:true})
    })).status,layout.id);
    expect(status).toBe(403);expect(await current(request)).toEqual(before);
  }finally{await context.close();}
});

test('local fixture publication requires confirmation and stays unchanged after further draft edits',async({page,request})=>{
  const layout=await draft(request,[bench()]),before=await current(request);
  await page.goto('/workspace.html');
  const row=page.locator('#draftRows tr').filter({hasText:layout.name});
  await row.getByRole('button',{name:'Publish',exact:true}).click();
  await page.getByRole('button',{name:'Publish as current',exact:true}).click();
  await expect(page.locator('#publishDialog')).toBeVisible();
  expect(await current(request)).toEqual(before);
  await page.getByRole('checkbox',{name:'I checked that this arrangement matches the physical gym.'}).check();
  await page.getByRole('button',{name:'Publish as current',exact:true}).click();
  await expect(page.locator('#publishDialog')).not.toBeVisible();
  const published=await current(request);expect(published.current.layout.name).toBe(layout.name);
  await page.goto('/map.html');
  await expect(page.locator('#mapName')).toHaveText(layout.name);
  await page.locator('#equipmentList button').click();
  await expect(page.locator('#equipmentDetails')).toContainText('Competition Bench');
  await expect(page.locator('[data-prop]')).toHaveCount(0);
  await open(page,layout.id);await edit(page,'[data-prop="x"]',25);
  await expect.poll(async()=>(await read(request,layout.id)).layout.items[0].x).toBe(25);
  expect(await current(request)).toEqual(published);
});
