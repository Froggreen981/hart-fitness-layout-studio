import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

async function seed(request){
  const equipment=(id,x,y)=>({id,name:'TEST '+id,category:'free',kind:'bench',width:3,length:5,x,y,rotation:0,buffer:0,locked:false});
  const layout={id:randomUUID(),name:'TEST ONLY planner '+randomUUID(),room:{width:50,length:40,areasMigrated:true},items:[
    equipment('floor-unit',6,6),equipment('other-unit',30,20),
    {...equipment('stored-unit',12,22),storedIn:'@storage',storageX:3,storageY:4}
  ]};
  const response=await request.post('/api/drafts',{data:{layout,library:[]}});
  expect(response.ok()).toBeTruthy();return (await response.json()).layout;
}
async function read(request,id){return (await (await request.get('/api/drafts/'+id)).json()).layout;}
async function open(page,id){await page.goto('/index.html?draft='+id);await expect(page.locator('.draft-badge')).toHaveText('SHARED DRAFT');}
async function edit(page,selector,value){await page.locator(selector).fill(String(value));await page.locator(selector).press('Tab');}

test('storage transfers and coordinate edits persist while retaining the last gym position',async({page,request})=>{
  const layout=await seed(request);await open(page,layout.id);
  await page.locator('[data-action="store"]').click();
  await expect.poll(async()=>(await read(request,layout.id)).items[0].storedIn).toBe('@storage');
  await expect(page.locator('#storageCount')).toHaveText('2 pieces');
  await edit(page,'[data-prop="x"]',9);
  await edit(page,'[data-prop="y"]',11);
  await expect.poll(async()=>(await read(request,layout.id)).items[0].storageY).toBe(11);
  await page.reload();await expect(page.locator('[data-prop="x"]')).toHaveValue('9');
  await page.locator('[data-action="return-floor"]').click();
  await expect.poll(async()=>(await read(request,layout.id)).items[0].storedIn||'floor').toBe('floor');
  const returned=(await read(request,layout.id)).items[0];
  expect(returned).toMatchObject({id:'floor-unit',x:6,y:6,width:3,length:5,storageX:9,storageY:11});
  await expect(page.locator('#board [data-id="floor-unit"]')).toBeVisible();
});

test('tiled custom print preview crops legends and excludes stored equipment and editor controls',async({page,request})=>{
  const layout=await seed(request);await open(page,layout.id);
  await page.addInitScript(()=>{window.print=()=>{window.__printed=true;};});
  await page.reload();await page.locator('#printBtn').click();
  await page.locator('#printScope').selectOption('custom');
  for(const [key,value] of Object.entries({x:0,y:0,w:20,h:20}))await page.locator('#print-'+key).fill(String(value));
  await page.locator('#printSheets').selectOption('2');await page.locator('#previewPrint').click();
  await expect(page.locator('.print-sheet')).toHaveCount(4);
  expect(await page.locator('.print-map > svg').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('viewBox')))).toEqual(['0 0 10 10','10 0 10 10','0 10 10 10','10 10 10 10']);
  await expect(page.locator('.print-sheet').nth(0).locator('.legend-items')).toContainText('TEST floor-unit');
  await expect(page.locator('.print-sheet').nth(1).locator('.legend-items')).toContainText('No floor equipment');
  await expect(page.locator('.print-sheet').nth(2).locator('.legend-items')).toContainText('TEST floor-unit');
  const legendText=(await page.locator('.legend-items').allTextContents()).join(' ');
  for(const name of ['TEST stored-unit','TEST other-unit'])expect(legendText).not.toContain(name);
  await expect(page.locator('#printPages [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('#printPages [data-id="stored-unit"]')).toHaveCount(0);
  const ids=await page.locator('#printPages [id]').evaluateAll(nodes=>nodes.map(node=>node.id));expect(new Set(ids).size).toBe(ids.length);
  await page.locator('#confirmPrint').click();expect(await page.evaluate(()=>window.__printed)).toBe(true);
  await page.emulateMedia({media:'print'});await expect(page.locator('.topbar')).toBeHidden();
  await page.emulateMedia({media:'screen'});await page.locator('#closePrintPreview').click();
  await expect(page.locator('#printPreview')).toBeHidden();
  expect((await read(request,layout.id)).items).toEqual(layout.items);
});

test('map buttons activate with Space or Enter and keyboard nudges respect locks',async({page,request})=>{
  const layout=await seed(request);await open(page,layout.id);
  const other=page.locator('#board [data-id="other-unit"]');
  await other.focus();await other.press('Space');
  await expect(other).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async()=>(await read(request,layout.id)).items[1].x).toBe(30.5);
  await page.locator('[data-prop="locked"]').check();
  await page.locator('#board').focus();await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-prop="x"]')).toHaveValue('30.5');
  const stored=page.locator('#storageBoard [data-storage-id="stored-unit"]');
  await stored.focus();await stored.press('Space');
  await expect(stored).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async()=>(await read(request,layout.id)).items[2].storageX).toBe(3.5);
  await page.locator('#board [data-id="floor-unit"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#board [data-id="floor-unit"]')).toHaveAttribute('aria-pressed','true');
});

test('pointer or touch selection opens equipment details and persists renamed equipment',async({page,request,isMobile})=>{
  const layout=await seed(request);await open(page,layout.id);
  const other=page.locator('#board [data-id="other-unit"]');await other.scrollIntoViewIfNeeded();
  if(isMobile){const box=await other.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
  else await other.click();
  await expect(other).toHaveAttribute('aria-pressed','true');
  await page.locator('#editSelectionBtn').click();
  await edit(page,'[data-prop="name"]','TEST renamed from Details');
  await expect.poll(async()=>(await read(request,layout.id)).items[1].name).toBe('TEST renamed from Details');
  await page.reload();await expect(page.locator('#inventoryRows')).toContainText('TEST renamed from Details');
});
