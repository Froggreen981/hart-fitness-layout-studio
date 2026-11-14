import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {packageRelease,releaseFiles} from './scripts/prepare-release.mjs';
import {sha256} from './scripts/release-contract.mjs';

test('release archive contains only Worker, existing manifest and immutable migrations with verifiable provenance',async t=>{
  const root=await mkdtemp(join(tmpdir(),'gym-artifact-fixture-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const path of ['release','.openai','db','drizzle','drizzle.config.ts','dist/building-plan.mjs'])await cp(path,join(root,path),{recursive:true});
  await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'dist/.openai'),{recursive:true});
  await cp('.openai/hosting.json',join(root,'dist/.openai/hosting.json'));
  await writeFile(join(root,'dist/server/index.js'),'export default {fetch(){return new Response("fixture");}};');
  await writeFile(join(root,'.env'),'PRIVATE_FIXTURE_SECRET');await writeFile(join(root,'.gym-dev.sqlite'),'PRIVATE_FIXTURE_DATA');
  const result=await packageRelease(root,join(root,'output'),{github_commit:'fixture-only'},[{command:['fixture-check'],status:'passed'}]);
  assert.deepEqual(result.archive.files,[...releaseFiles].sort());
  assert.equal(result.archive.sha256,sha256(await readFile(result.archive.path)));
  assert.equal(result.production_deployed,false);assert.equal(result.sites_version_saved,false);
  const worker=execFileSync('tar',['-xOzf',result.archive.path,'dist/server/index.js'],{encoding:'utf8'});
  assert.equal(sha256(worker),result.worker.sha256);assert.doesNotMatch(worker,/PRIVATE_FIXTURE/);
  const stored=JSON.parse(await readFile(join(root,'output/release.json'),'utf8'));
  assert.equal(stored.github_commit,'fixture-only');assert.equal(stored.contract.schema_change,false);
});
