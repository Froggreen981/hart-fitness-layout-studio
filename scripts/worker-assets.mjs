import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg'};

export async function collectWorkerAssets(staticRoot){
  const assets={};
  async function collect(directory){
    const entries=(await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for(const entry of entries){
      if(entry.name.startsWith('.')||entry.name==='server')continue;
      const path=resolve(directory,entry.name);
      if(entry.isSymbolicLink())throw Error('Worker assets must not be symbolic links: '+entry.name);
      if(entry.isDirectory()){await collect(path);continue;}
      const type=types[extname(path)];
      if(!type)throw Error('Unexpected file in public Worker assets: '+relative(staticRoot,path));
      assets['/'+relative(staticRoot,path).replaceAll('\\','/')]=[type,(await readFile(path)).toString('base64')];
    }
  }
  await collect(staticRoot);return assets;
}
