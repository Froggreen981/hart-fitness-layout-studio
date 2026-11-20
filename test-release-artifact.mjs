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

test('candidate audit detects altered payloads and packaging retains the previous complete candidate',async t=>{
  const {inspectCandidate}=await import('./scripts/release-preflight.mjs');
  const root=await mkdtemp(join(tmpdir(),'gym-candidate-audit-'));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const path of ['release','.openai','db','drizzle','drizzle.config.ts','dist/building-plan.mjs'])await cp(path,join(root,path),{recursive:true});
  await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'dist/.openai'),{recursive:true});
  await cp('.openai/hosting.json',join(root,'dist/.openai/hosting.json'));
  await writeFile(join(root,'dist/server/index.js'),'export default {fetch(){return new Response("fixture");}};');
  const output=join(root,'candidate'),provenance={github_commit:'fixture-commit',source_tree:'fixture-tree',
    github_repository:'Froggreen981/hart-fitness-layout-studio',github_branch:'codex/shared-gym-layouts'};
  const checks=['npm test','npm run build','npm run test:browser','npm run test:browser:worker'].map(command=>({command:command.split(' '),status:'passed'}));
  const metadata=await packageRelease(root,output,provenance,checks);
  const audit=()=>inspectCandidate(root,output,{commit:provenance.github_commit,tree:provenance.source_tree});
  assert.equal((await audit()).archive_sha256,metadata.archive.sha256);
  await writeFile(join(output,'release.json'),JSON.stringify({...metadata,github_repository:'unrelated/repository'}));
  await assert.rejects(audit(),/provenance/);
  await writeFile(join(output,'release.json'),JSON.stringify(metadata));
  await assert.rejects(packageRelease(root,output,provenance,checks));
  assert.equal((await audit()).archive_sha256,metadata.archive.sha256);
  await assert.rejects(inspectCandidate(root,output,{commit:'different',tree:provenance.source_tree}),/provenance/);
  await writeFile(join(root,'dist/server/index.js'),'export default {};');
  await assert.rejects(audit(),/does not match/);
  await writeFile(join(root,'.env'),'PRIVATE_FIXTURE_SECRET');
  execFileSync('tar',['-czf',metadata.archive.path,'-C',root,...releaseFiles,'.env']);
  await writeFile(join(output,'release.json'),JSON.stringify({...metadata,archive:{...metadata.archive,sha256:sha256(await readFile(metadata.archive.path))}}));
  await assert.rejects(audit(),/unexpected paths/,'even a matching archive hash cannot authorize extra files');
  await writeFile(metadata.archive.path,'interrupted or tampered archive');
  await assert.rejects(audit(),/hash mismatch/);
});
