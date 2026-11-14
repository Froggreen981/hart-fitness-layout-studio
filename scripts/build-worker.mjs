import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve('.'),staticRoot=resolve('dist'),assets={};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg'};
async function collect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);if(entry.isDirectory()){if(!['server','.openai'].includes(entry.name))await collect(path);}else assets['/'+relative(staticRoot,path).replaceAll('\\','/')]=[types[extname(path)]||'application/octet-stream',(await readFile(path)).toString('base64')];}}
await collect(staticRoot);
const workerModules=['dist/model.mjs','worker/workout-api.mjs','worker/service.mjs'];
const sources=await Promise.all(workerModules.map(path=>readFile(path,'utf8')));
const bundled=sources.map(source=>source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
const output=bundled+'\nconst ASSETS='+JSON.stringify(assets)+`;
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return api(request,env);
 const key=url.pathname==='/'?'/workspace.html':url.pathname,asset=ASSETS[key];
 if(!asset)return new Response('Not found',{status:404});
 const bytes=Uint8Array.from(atob(asset[1]),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset[0],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}};
`;
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/server/index.js',output);await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built dependency-free Worker with '+Object.keys(assets).length+' embedded planner assets.');
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
if(typeof module.default?.fetch!=='function')throw new Error('Worker fetch export missing.');
console.log('Worker ESM validation passed.');

