// Read-only local audit. Never opens D1, calls Sites, or changes Git refs.
import {readFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {checkReleaseContract,checkBuiltWorker,sha256} from './release-contract.mjs';
import {releaseFiles} from './prepare-release.mjs';

export async function inspectCandidate(root,directory,{commit,tree}={}){
  const metadata=JSON.parse(await readFile(join(directory,'release.json'),'utf8'));
  const archive=join(directory,'candidate.tar.gz');
  if(!(await lstat(archive)).isFile())throw Error('Candidate archive must be a regular file.');
  if(metadata.format!=='gym-local-release-v1'||metadata.github_commit!==commit||metadata.source_tree!==tree)
    throw Error('Candidate provenance does not match the reviewed GitHub commit/tree.');
  if(metadata.archive?.sha256!==sha256(await readFile(archive)))throw Error('Candidate archive hash mismatch.');
  const members=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n').sort();
  const types=execFileSync('tar',['-tvzf',archive],{encoding:'utf8'}).trim().split('\n');
  if(JSON.stringify(members)!==JSON.stringify([...releaseFiles].sort())||types.some(line=>!line.startsWith('-')))
    throw Error('Candidate contains unexpected paths or non-regular entries.');
  const contract=await checkReleaseContract(root),worker=await checkBuiltWorker(root);
  for(const path of releaseFiles){
    const bytes=execFileSync('tar',['-xOzf',archive,path],{maxBuffer:16*1024*1024});
    const expected=path==='dist/server/index.js'?worker.sha256:contract.files[path];
    if(sha256(bytes)!==expected)throw Error('Candidate file does not match reviewed source/build: '+path);
  }
  if(metadata.worker?.sha256!==worker.sha256||metadata.contract?.schema_change!==false||
      metadata.contract?.project_id!==contract.project_id||metadata.contract?.d1_binding!==contract.d1_binding)
    throw Error('Candidate contract or Worker provenance mismatch.');
  const required=['npm test','npm run build','npm run test:browser','npm run test:browser:worker'];
  if(required.some(command=>!metadata.checks?.some(check=>check.command?.join(' ')===command&&check.status==='passed')))
    throw Error('Candidate is missing required verification records.');
  return {path:resolve(directory),archive_sha256:metadata.archive.sha256,worker_sha256:worker.sha256,
    recorded_checks:required,note:'Hashes verified; recorded checks are preparation evidence, not a rerun or CI attestation.'};
}

export async function releasePreflight(root=resolve('.'),{candidate,remote=false}={}){
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const commit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
  const branch=git('branch','--show-current'),clean=!git('status','--porcelain');
  const contract=await checkReleaseContract(root),worker=await checkBuiltWorker(root);
  const report={format:'gym-release-preflight-v1',github_commit:commit,source_tree:tree,branch,clean,
    contract,worker,remote_head:null,candidate:null,local_ready:false,
    production_verified:false,manual_gates:[
      'Supported full D1 backup/restore point and applied migration ledger',
      'Live owner authentication and manager Site visitor access plus application role',
      'Official existing-Site source workflow and exact GitHub/Sites commit mapping',
      'Fresh Sites version/audience/domain/DB comparison and deployment authorization',
      'Read-only post-deployment checks; physical verification/publication is separate',
      'Independent workout gateway/credential rollout and reviewed exercise mappings'
    ]};
  if(remote){
    if(!/^https:\/\/github\.com\/Froggreen981\/hart-fitness-layout-studio(?:\.git)?$/.test(git('remote','get-url','origin')))
      throw Error('Unexpected GitHub origin.');
    report.remote_head=git('ls-remote','--exit-code','origin','refs/heads/codex/shared-gym-layouts').split(/\s/)[0];
  }
  if(candidate)report.candidate=await inspectCandidate(root,resolve(candidate),{commit,tree});
  report.local_ready=clean&&branch==='codex/shared-gym-layouts'&&report.remote_head===commit&&!!report.candidate;
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);let candidate,remote=false;
  while(args.length){const arg=args.shift();if(arg==='--remote')remote=true;
    else if(arg==='--candidate'&&args[0]&&!args[0].startsWith('--'))candidate=args.shift();
    else throw Error('Usage: npm run release:preflight -- [--remote] [--candidate DIRECTORY]');}
  console.log(JSON.stringify(await releasePreflight(resolve('.'),{candidate,remote}),null,2));
}
