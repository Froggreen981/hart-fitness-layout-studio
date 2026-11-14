import {test,expect} from '@playwright/test';

test('release entrypoints load all planner and catalog modules without browser errors',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const [path,ready] of [['/workspace.html','#workspaceContent'],['/equipment-checklist.html','#item-CHK-001'],['/map.html','#publicMap'],['/index.html','#board']]){
    const response=await page.goto(path);expect(response.status()).toBe(200);
    await expect(page.locator(ready)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('release HTTP boundary rejects anonymous staff and cross-origin writes while workout API stays disabled',async({request})=>{
  const before=await (await request.get('/api/current')).json();
  const anonymous=await request.get('/api/drafts?test_actor=anonymous',{
    headers:{'oai-authenticated-user-id':'forged-owner','oai-authenticated-user-email':'owner@example.test'}
  });
  expect(anonymous.status()).toBe(401);
  const crossOrigin=await request.post('/api/import',{headers:{Origin:'https://foreign.example'},data:{requestId:'must-not-write'}});
  expect(crossOrigin.status()).toBe(403);
  const integration=await request.get('/api/v1/layout');expect(integration.status()).toBe(503);
  expect((await integration.json()).error.code).toBe('integration_unavailable');
  expect(await (await request.get('/api/current')).json()).toEqual(before);
  const head=await request.head('/equipment-checklist.html');expect(head.status()).toBe(200);expect(await head.body()).toHaveLength(0);
  if(process.env.GYM_BROWSER_TARGET==='worker')expect(head.headers()['x-content-type-options']).toBe('nosniff');
});
