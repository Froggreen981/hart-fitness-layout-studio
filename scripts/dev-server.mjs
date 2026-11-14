import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sqliteDB} from './sqlite-db.mjs';
import {api} from '../worker/service.mjs';
const root=fileURLToPath(new URL('../dist',import.meta.url));
const db=sqliteDB(process.env.GYM_DEV_DB||resolve('.gym-dev.sqlite'));
const port=Number(process.env.PORT||4173);
const owner=process.env.GYM_DEV_OWNER||'owner@example.test';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.pathname.startsWith('/api/')){
   const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>7*1024*1024){res.writeHead(413);res.end();return;}chunks.push(c);}
   const headers=new Headers(req.headers);
   // Localhost-only test identities. This code is never included in the hosted Worker.
   const actor=url.searchParams.get('test_actor');
   headers.set('oai-authenticated-user-id',actor==='anonymous'?'':'local-'+(actor||'owner'));
   headers.set('oai-authenticated-user-email',actor==='anonymous'?'':actor||owner);
   const request=new Request(url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   const response=await api(request,{DB:db,STAFF_OWNER_EMAIL:owner,WORKOUT_API_TOKEN_SHA256:process.env.WORKOUT_API_TOKEN_SHA256});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  let path=decodeURIComponent(url.pathname);if(path==='/')path='/workspace.html';
  const file=resolve(root,'.'+path);if(!file.startsWith(root+String.fromCharCode(92))&&!file.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+' (local test identity, SQLite persistence)'));
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));

