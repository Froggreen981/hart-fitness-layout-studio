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

async function smokeTransport(request,actor){
  return async(url,options)=>{
    expect(options.method).toBe('GET');expect(options.redirect).toBe('manual');
    const target=new URL(url);if(actor)target.searchParams.set('test_actor',actor);
    const response=await request.get(target.href,{maxRedirects:0});
    return new Response(await response.body(),{status:response.status(),headers:response.headers()});
  };
}

test('operational owner smoke fingerprints packaged assets and preserves fixture state using GET only',async({request,baseURL})=>{
  const {readOnlySmoke,compareReadOnlyEvidence}=await import('../../scripts/read-only-smoke.mjs');
  const {assetFingerprints}=await import('../../scripts/worker-assets.mjs');
  const assets=await assetFingerprints(new URL('../../dist/',import.meta.url).pathname);
  const fetchImpl=await smokeTransport(request);
  const before=await readOnlySmoke({origin:baseURL,profile:'baseline',maxPages:10,fetchImpl});
  const after=await readOnlySmoke({origin:baseURL,profile:'candidate',assets,maxPages:10,fetchImpl});
  expect(before.status).toBe('passed');expect(after.status).toBe('passed');
  expect(after.asset_hashes_verified).toBe(true);expect(after.limits.full_database_backup).toBe(false);
  expect(compareReadOnlyEvidence(before,after).status).toBe('passed');
});

test('operational editor smoke verifies reported role and owner denial without publication attempts',async({request,baseURL})=>{
  const {readOnlySmoke}=await import('../../scripts/read-only-smoke.mjs');
  const email='smoke-editor-'+crypto.randomUUID()+'@example.test';
  expect((await request.post('/api/staff',{data:{email,role:'editor'}})).ok()).toBe(true);
  const report=await readOnlySmoke({origin:baseURL,expectedRole:'editor',maxPages:10,fetchImpl:await smokeTransport(request,email)});
  expect(report.status).toBe('passed');expect(report.reported_role).toBe('editor');
  expect(report.checks.find(check=>check.name==='owner_controls_denied').http_status).toBe(403);
  expect(JSON.stringify(report)).not.toContain(email);
});
