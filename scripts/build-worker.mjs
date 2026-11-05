import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve('.'),staticRoot=resolve('dist'),assets={};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg'};
async function collect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory())await collect(path);else assets['/'+relative(staticRoot,path).replaceAll('\\','/')]=[types[extname(path)]||'application/octet-stream',(await readFile(path)).toString('base64')];}}
await collect(staticRoot);
const model=(await readFile('dist/model.mjs','utf8')).replaceAll('export ','');
const service=(await readFile('worker/service.mjs','utf8')).replace(/^import[^\n]*\n/,'').replaceAll('export ','');
const output=model+'\n'+service+'\nconst ASSETS='+JSON.stringify(assets)+`;
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env);
 const key=url.pathname==='/'?'/workspace.html':url.pathname,asset=ASSETS[key];
 if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[0],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
`;
await mkdir('build/server',{recursive:true});await writeFile('build/server/index.mjs',output);
console.log('Built dependency-free Worker with '+Object.keys(assets).length+' embedded planner assets.');
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
if(typeof module.default?.fetch!=='function')throw new Error('Worker fetch export missing.');
console.log('Worker ESM validation passed.');

