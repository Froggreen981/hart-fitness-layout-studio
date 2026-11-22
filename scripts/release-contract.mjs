import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function checkReleaseContract(root=resolve('.')){
  const baseline=JSON.parse(await readFile(resolve(root,'release/sites-v13-baseline.json'),'utf8'));
  const hosting=JSON.parse(await readFile(resolve(root,'.openai/hosting.json'),'utf8'));
  if(hosting.project_id!==baseline.project_id||hosting.d1!==baseline.d1_binding||hosting.r2!==null||hosting.static!==undefined){
    throw Error('Release must retain the existing Sites project, DB binding, null R2 and Worker hosting.');
  }
  const files={};
  for(const [path,expected] of Object.entries(baseline.unchanged_files)){
    const actual=sha256(await readFile(resolve(root,path)));files[path]=actual;
    if(actual!==expected)throw Error('Release baseline changed: '+path+'. Review migration/geometry/identity changes before updating the contract.');
  }
  const sqlFiles=(await readdir(resolve(root,'drizzle'))).filter(path=>path.endsWith('.sql')).sort();
  if(JSON.stringify(sqlFiles)!==JSON.stringify(baseline.sql_files))throw Error('This release must not introduce a new D1 migration.');
  return {project_id:hosting.project_id,d1_binding:hosting.d1,sites_baseline:baseline.sites_commit,files,schema_change:false};
}

export async function checkBuiltWorker(root=resolve('.')){
  const bytes=await readFile(resolve(root,'dist/server/index.js')),source=bytes.toString('utf8');
  for(const marker of ['test_actor','GYM_DEV_','owner@example.test','node:sqlite','CREATE TABLE','ALTER TABLE','DROP TABLE']){
    if(source.includes(marker))throw Error('Local identity/database or schema code found in Worker: '+marker);
  }
  const hosting=await readFile(resolve(root,'.openai/hosting.json'));
  if(!hosting.equals(await readFile(resolve(root,'dist/.openai/hosting.json'))))throw Error('Built hosting manifest differs from source.');
  return {path:'dist/server/index.js',sha256:sha256(bytes),size_bytes:bytes.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  console.log(JSON.stringify(await checkReleaseContract(),null,2));
}
