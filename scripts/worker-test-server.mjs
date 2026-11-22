// Test transport only. Identity injection and SQLite are never part of the Worker bundle.
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sqliteDB} from './sqlite-db.mjs';
import worker from '../dist/server/index.js';

const directory=mkdtempSync(join(tmpdir(),'gym-packaged-worker-'));
const DB=sqliteDB(join(directory,'test.sqlite'));
const env={DB,STAFF_OWNER_EMAIL:'owner@example.test'};
const port=Number(process.env.PORT||4189);
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:'+port),headers=new Headers(req.headers);
    const actor=url.searchParams.get('test_actor');
    headers.set('oai-authenticated-user-id',actor==='anonymous'?'':'fixture-'+(actor||'owner'));
    headers.set('oai-authenticated-user-email',actor==='anonymous'?'':actor||env.STAFF_OWNER_EMAIL);
    const chunks=[];let bytes=0;
    for await(const chunk of req){bytes+=chunk.length;if(bytes>7*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const response=await worker.fetch(new Request(url,{method:req.method,headers,
      ...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}),env);
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){console.error('Packaged Worker test transport failed:',error.message);res.writeHead(500);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('Packaged Worker test: http://127.0.0.1:'+port));
const close=()=>server.close(()=>{DB.close();process.exit(0);});
process.on('SIGINT',close);process.on('SIGTERM',close);
process.on('exit',()=>rmSync(directory,{recursive:true,force:true}));
