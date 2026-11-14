import {spawnSync} from 'node:child_process';

for(const args of [['scripts/build-worker.mjs'],['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)]]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,GYM_BROWSER_TARGET:'worker'}});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
