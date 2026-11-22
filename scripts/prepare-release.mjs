import {readFile,writeFile,mkdir,mkdtemp,rm,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {checkReleaseContract,checkBuiltWorker,sha256} from './release-contract.mjs';
import {assetFingerprints} from './worker-assets.mjs';

export const releaseFiles=['.openai/hosting.json','dist/server/index.js',
  'drizzle/0000_shared_layouts.sql','drizzle/meta/_journal.json','drizzle/meta/0000_snapshot.json'];

export async function packageRelease(root,output,provenance,checks){
  const contract=await checkReleaseContract(root),worker=await checkBuiltWorker(root);
  const stage=await mkdtemp(join(tmpdir(),'gym-release-stage-'));
  await mkdir(dirname(resolve(output)),{recursive:true});
  const pending=await mkdtemp(join(dirname(resolve(output)),'.gym-candidate-'));
  try{
    for(const path of releaseFiles){const target=join(stage,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,await readFile(join(root,path)));}
    const archive=resolve(pending,'candidate.tar.gz');
    execFileSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','--format=ustar','-czf',archive,'-C',stage,...releaseFiles],{stdio:'pipe'});
    const contents=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n').sort();
    if(JSON.stringify(contents)!==JSON.stringify([...releaseFiles].sort()))throw Error('Unexpected release archive contents.');
    const metadata={format:'gym-local-release-v1',prepared_at:new Date().toISOString(),
      ...provenance,contract,worker,checks,static_assets:await assetFingerprints(join(root,'dist')),
      archive:{path:resolve(output,'candidate.tar.gz'),sha256:sha256(await readFile(archive)),files:contents},
      sites_version_saved:false,production_deployed:false,
      note:'Local candidate only. Before native save, synchronize this exact source tree through the Sites source workflow, rebuild/package there, and compare Worker hashes.'};
    await writeFile(join(pending,'release.json'),JSON.stringify(metadata,null,2)+'\n');
    // Commit the complete pair together; retain an existing candidate unchanged.
    await rename(pending,output);return metadata;
  }finally{await rm(stage,{recursive:true,force:true});await rm(pending,{recursive:true,force:true});}
}

async function prepare(){
  const root=resolve('.'),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  if(Number(process.versions.node.split('.')[0])<24)throw Error('Release preparation requires Node 24 or later.');
  if(git('branch','--show-current')!=='codex/shared-gym-layouts')throw Error('Prepare releases from codex/shared-gym-layouts.');
  if(git('status','--porcelain'))throw Error('Commit all source changes before preparing a release.');
  const github_commit=git('rev-parse','HEAD'),source_tree=git('rev-parse','HEAD^{tree}');
  const remote=git('remote','get-url','origin');
  if(!/^https:\/\/github\.com\/Froggreen981\/hart-fitness-layout-studio(?:\.git)?$/.test(remote))throw Error('Origin must be the authoritative GitHub repository.');
  const remoteHead=git('ls-remote','--exit-code','origin','refs/heads/codex/shared-gym-layouts').split(/\s/)[0];
  if(remoteHead!==github_commit)throw Error('Push the reviewed commit normally before preparing a release; do not force or overwrite divergent history.');
  await checkReleaseContract(root);
  const checks=[];
  for(const command of [['npm','test'],['npm','run','build'],['npm','run','test:browser'],['npm','run','test:browser:worker']]){
    const result=spawnSync(command[0],command.slice(1),{cwd:root,stdio:'inherit'});
    if(result.error)throw result.error;
    if(result.status!==0)throw Error('Release check failed: '+command.join(' '));
    checks.push({command,status:'passed'});
  }
  if(git('status','--porcelain')||git('rev-parse','HEAD')!==github_commit)throw Error('Source changed during release checks.');
  if(git('ls-remote','--exit-code','origin','refs/heads/codex/shared-gym-layouts').split(/\s/)[0]!==github_commit)throw Error('Remote advanced during checks; reconcile before preparing a candidate.');
  const metadata=await packageRelease(root,join(root,'build/releases',github_commit),{
    github_repository:'Froggreen981/hart-fitness-layout-studio',github_branch:'codex/shared-gym-layouts',github_commit,source_tree
  },checks);
  console.log(JSON.stringify(metadata,null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await prepare();
