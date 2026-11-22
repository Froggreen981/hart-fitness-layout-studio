import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {compareSitesSource} from './scripts/compare-sites-source.mjs';
import {packageRelease} from './scripts/prepare-release.mjs';

const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
async function setup(t){
  const dir=await mkdtemp(join(tmpdir(),'gym-source-compare-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const archive=execFileSync('git',['archive','HEAD'],{maxBuffer:16*1024*1024});
  const githubRoot=join(dir,'github'),sitesRoot=join(dir,'sites');
  for(const root of [githubRoot,sitesRoot]){
    await mkdir(root);execFileSync('tar',['-x','-C',root],{input:archive});
    git(root,'init','-q');git(root,'config','user.name','Source comparison fixture');git(root,'config','user.email','fixture@example.test');
    git(root,'add','.');git(root,'commit','-qm',root===githubRoot?'GitHub fixture':'Sites fixture');
    await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'dist/.openai'),{recursive:true});
    await cp(join(root,'.openai/hosting.json'),join(root,'dist/.openai/hosting.json'));
    await writeFile(join(root,'dist/server/index.js'),'export default {fetch(){return new Response("fictional source comparison");}};');
  }
  git(githubRoot,'remote','add','origin','https://github.com/Froggreen981/hart-fitness-layout-studio.git');
  const candidate=join(githubRoot,'build/releases/fixture');
  await packageRelease(githubRoot,candidate,{
    github_repository:'Froggreen981/hart-fitness-layout-studio',github_branch:'codex/shared-gym-layouts',
    github_commit:git(githubRoot,'rev-parse','HEAD'),source_tree:git(githubRoot,'rev-parse','HEAD^{tree}')
  },['npm test','npm run build','npm run test:browser','npm run test:browser:worker'].map(command=>({command:command.split(' '),status:'passed'})));
  return {githubRoot,sitesRoot,candidate,expectedSitesCommit:git(sitesRoot,'rev-parse','HEAD')};
}

test('source comparison recognizes equal trees with distinct GitHub/Sites commits and matching rebuilt Worker',async t=>{
  const options=await setup(t),beforeGithub=git(options.githubRoot,'rev-parse','HEAD'),beforeSites=git(options.sitesRoot,'rev-parse','HEAD');
  const report=await compareSitesSource(options);
  assert.notEqual(report.github.commit,report.sites.commit);assert.equal(report.source_trees_match,true);
  assert.equal(report.worker_matches,true);assert.equal(report.comparison_passed,true);
  assert.equal(report.production_authorized,false);assert.equal(report.native_source_origin_verified,false);
  assert.equal(git(options.githubRoot,'rev-parse','HEAD'),beforeGithub);assert.equal(git(options.sitesRoot,'rev-parse','HEAD'),beforeSites);
  assert.equal(git(options.sitesRoot,'status','--porcelain'),'');
});

test('source comparison rejects advanced, dirty or identity-changed source without altering either history',async t=>{
  const options=await setup(t);
  const original=await readFile(join(options.sitesRoot,'README.md'),'utf8');
  await writeFile(join(options.sitesRoot,'README.md'),original+'\nUnreviewed Sites fixture change\n');
  const dirty=await compareSitesSource(options);assert.equal(dirty.sites.clean,false);assert.equal(dirty.comparison_passed,false);
  git(options.sitesRoot,'add','README.md');git(options.sitesRoot,'commit','-qm','Unrelated Sites fixture work');
  const advanced=await compareSitesSource(options);assert.equal(advanced.source_trees_match,false);assert.equal(advanced.sites.helper_commit_matches,false);
  assert.equal(advanced.comparison_passed,false);
  await writeFile(join(options.sitesRoot,'.openai/hosting.json'),JSON.stringify({project_id:'wrong-fixture',d1:'DB',r2:null}));
  git(options.sitesRoot,'add','.openai/hosting.json');git(options.sitesRoot,'commit','-qm','Wrong fixture identity');
  const wrong=await compareSitesSource({...options,expectedSitesCommit:git(options.sitesRoot,'rev-parse','HEAD')});
  assert.equal(wrong.identity_matches,false);assert.equal(wrong.comparison_passed,false);
  assert.ok(wrong.protected_files.some(file=>!file.matches));
});

test('missing helper provenance or mismatched/missing Worker cannot pass source comparison',async t=>{
  const options=await setup(t);
  assert.equal((await compareSitesSource({...options,expectedSitesCommit:undefined})).comparison_passed,false);
  await writeFile(join(options.sitesRoot,'dist/server/index.js'),'export default {};');
  const changed=await compareSitesSource(options);assert.equal(changed.worker_matches,false);assert.equal(changed.comparison_passed,false);
  await rm(join(options.sitesRoot,'dist/server/index.js'));
  const missing=await compareSitesSource(options);assert.equal(missing.sites_worker_sha256,null);assert.match(missing.worker_issue,/missing/);
  await assert.rejects(compareSitesSource({...options,expectedSitesCommit:'short-sha'}),/full commit/);
});
