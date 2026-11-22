// Read-only comparison of a reviewed GitHub candidate and the official helper's checkout.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectCandidate} from './release-preflight.mjs';
import {checkReleaseContract,checkBuiltWorker,sha256} from './release-contract.mjs';

function git(root,...args){return execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();}
function object(root,commit,path){
  try{return execFileSync('git',['show',commit+':'+path],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});}
  catch{return null;}
}

export async function compareSitesSource({githubRoot=resolve('.'),candidate,sitesRoot,expectedSitesCommit}={}){
  githubRoot=resolve(githubRoot);sitesRoot=resolve(sitesRoot);candidate=resolve(githubRoot,candidate);
  if(expectedSitesCommit!==undefined&&!/^[a-f0-9]{40}$/.test(expectedSitesCommit))throw Error('Use the full commit returned by the official Sites helper.');
  if(!/^https:\/\/github\.com\/Froggreen981\/hart-fitness-layout-studio(?:\.git)?$/.test(git(githubRoot,'remote','get-url','origin')))
    throw Error('Unexpected authoritative GitHub origin.');
  const githubCommit=git(githubRoot,'rev-parse','HEAD'),githubTree=git(githubRoot,'rev-parse','HEAD^{tree}');
  const candidateAudit=await inspectCandidate(githubRoot,candidate,{commit:githubCommit,tree:githubTree});
  const contract=await checkReleaseContract(githubRoot);
  const sitesCommit=git(sitesRoot,'rev-parse','HEAD'),sitesTree=git(sitesRoot,'rev-parse','HEAD^{tree}');
  const helperCommitMatches=expectedSitesCommit?sitesCommit===expectedSitesCommit:false;
  const protectedFiles=Object.entries(contract.files).map(([path,expected])=>{
    const bytes=object(sitesRoot,sitesCommit,path);
    return {path,exists:!!bytes,matches:!!bytes&&sha256(bytes)===expected};
  });
  const siteManifest=object(sitesRoot,sitesCommit,'.openai/hosting.json');let identityMatches=false;
  try{const hosting=JSON.parse(siteManifest);identityMatches=hosting.project_id===contract.project_id&&hosting.d1===contract.d1_binding&&hosting.r2===null&&hosting.static===undefined;}catch{}
  let sitesWorker=null,workerIssue=null;
  try{sitesWorker=await checkBuiltWorker(sitesRoot);}catch{workerIssue='Sites build is missing or fails Worker/hosting validation.';}
  const cleanGithub=!git(githubRoot,'status','--porcelain'),cleanSites=!git(sitesRoot,'status','--porcelain');
  const treesMatch=githubTree===sitesTree,workerMatches=sitesWorker?.sha256===candidateAudit.worker_sha256;
  const report={format:'gym-sites-source-comparison-v1',observed_at:new Date().toISOString(),project_id:contract.project_id,
    github:{commit:githubCommit,tree:githubTree,clean:cleanGithub},sites:{commit:sitesCommit,tree:sitesTree,clean:cleanSites,
      helper_commit_supplied:!!expectedSitesCommit,helper_commit_matches:helperCommitMatches},
    source_trees_match:treesMatch,identity_matches:identityMatches,protected_files:protectedFiles,
    candidate_archive_sha256:candidateAudit.archive_sha256,candidate_worker_sha256:candidateAudit.worker_sha256,
    sites_worker_sha256:sitesWorker?.sha256??null,worker_matches:workerMatches,worker_issue:workerIssue,
    comparison_passed:cleanGithub&&cleanSites&&treesMatch&&identityMatches&&protectedFiles.every(file=>file.matches)&&workerMatches&&helperCommitMatches,
    production_authorized:false,native_source_origin_verified:false,
    note:'Use only the checkout and full commit returned by the official Sites helper. This compares local evidence; it does not verify the native repository origin or authorize/push/save/deploy anything.'};
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),options={};
  while(args.length){const flag=args.shift(),value=args.shift();if(!value)throw Error('Every option requires a value.');
    if(flag==='--candidate')options.candidate=value;else if(flag==='--sites-checkout')options.sitesRoot=value;
    else if(flag==='--sites-commit')options.expectedSitesCommit=value;else throw Error('Unknown source-comparison option.');}
  if(!options.candidate||!options.sitesRoot)throw Error('Supply --candidate and the official --sites-checkout.');
  const report=await compareSitesSource(options);console.log(JSON.stringify(report,null,2));process.exitCode=report.comparison_passed?0:2;
}
