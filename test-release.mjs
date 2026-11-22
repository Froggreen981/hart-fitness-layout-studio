import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,writeFile,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkReleaseContract} from './scripts/release-contract.mjs';
import {collectWorkerAssets} from './scripts/worker-assets.mjs';

test('release retains the verified Sites identity, existing D1 schema/migrations and geometry',async()=>{
  const contract=await checkReleaseContract();
  assert.equal(contract.project_id,'appgprj_6ae42d870d0481918f92cb6a7697a4d6');
  assert.equal(contract.d1_binding,'DB');assert.equal(contract.schema_change,false);
});

test('release guard rejects changed project identity or a new migration',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gym-release-contract-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const path of ['release','.openai','db','drizzle','drizzle.config.ts','dist/building-plan.mjs']){
    await cp(path,join(root,path),{recursive:true});
  }
  await writeFile(join(root,'.openai/hosting.json'),JSON.stringify({project_id:'different-site',d1:'DB',r2:null}));
  await assert.rejects(checkReleaseContract(root),/existing Sites project/);
  await cp('.openai/hosting.json',join(root,'.openai/hosting.json'));
  await writeFile(join(root,'drizzle/0001_unreviewed.sql'),'DROP TABLE gym_drafts;');
  await assert.rejects(checkReleaseContract(root),/new D1 migration/);
});

test('Worker asset packaging excludes hidden secrets and generated outputs and rejects database files/symlinks',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gym-worker-assets-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(join(root,'index.html'),'<h1>Fixture</h1>');
  await writeFile(join(root,'.env'),'PRIVATE_TEST_SECRET');
  await mkdir(join(root,'server'));await writeFile(join(root,'server/index.js'),'generated');
  assert.deepEqual(Object.keys(await collectWorkerAssets(root)),['/index.html']);
  await writeFile(join(root,'staff.sqlite'),'private database bytes');
  await assert.rejects(collectWorkerAssets(root),/Unexpected file/);
  await rm(join(root,'staff.sqlite'));await symlink(join(root,'.env'),join(root,'secret.js'));
  await assert.rejects(collectWorkerAssets(root),/symbolic links/);
});
