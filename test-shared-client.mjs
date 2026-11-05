import test from 'node:test';
import assert from 'node:assert/strict';
import {SharedEditor} from './dist/shared-client.mjs';
import {api} from './worker/service.mjs';
import {sqliteDB} from './scripts/sqlite-db.mjs';
function setup(t){
 const db=sqliteDB(),env={DB:db,STAFF_OWNER_EMAIL:'owner@example.test'},values=new Map();
 const before={fetch:globalThis.fetch,window:globalThis.window,localStorage:globalThis.localStorage};
 globalThis.window={addEventListener(){}};
 globalThis.localStorage={get length(){return values.size;},key(n){return [...values.keys()][n]||null;},getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,v);},removeItem(k){values.delete(k);}};
 let offline=false,loseResponse=false;
 const fetcher=async(path,options={})=>{
  if(offline)throw new TypeError('Network unavailable');
  const headers=new Headers(options.headers);headers.set('oai-authenticated-user-id','owner');headers.set('oai-authenticated-user-email','owner@example.test');
  const result=await api(new Request('https://gym.example.test'+path,{...options,headers}),env);
  if(loseResponse&&options.method==='PUT'){loseResponse=false;throw new TypeError('Response lost');}
  return result;
 };
 globalThis.fetch=fetcher;
 t.after(()=>{db.close();for(const [key,value]of Object.entries(before))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 const layout={id:'draft',name:'Client test',room:{width:100,length:90},items:[{id:'rack',name:'Rack',category:'strength',kind:'rack',width:4,length:7,x:10,y:10,rotation:0,locked:false,buffer:0}]};
 return {values,fetcher,offline:v=>offline=v,loseResponse:()=>loseResponse=true,async create(){return fetcher('/api/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({layout,library:[]})});}};
}
test('two editor tabs keep separate recovery copies and reject a stale save',async t=>{
 const s=setup(t);await s.create();
 const first=await SharedEditor.open('draft'),second=await SharedEditor.open('draft');
 first.project.layouts[0].items[0].x=20;second.project.layouts[0].items[0].x=30;
 first.queue(first.project);second.queue(second.project);
 assert.notEqual(first.key,second.key);
 await first.flush();assert.equal(s.values.has(second.key),true);
 await second.flush();assert.equal(second.blocked,true);assert.equal(s.values.has(second.key),true);
 const actual=await(await s.fetcher('/api/drafts/draft')).json();
 assert.equal(actual.layout.items[0].x,20);
});
test('an offline change can be saved as a new draft without replacing the server',async t=>{
 const s=setup(t);await s.create();const first=await SharedEditor.open('draft');
 first.project.layouts[0].items[0].x=40;s.offline(true);first.queue(first.project);await first.flush();
 assert.equal(first.pending.layouts[0].items[0].x,40);assert.equal(s.values.has(first.key),true);
 s.offline(false);
 const reopened=await SharedEditor.open('draft');assert.equal(reopened.recoveryPending,true);
 assert.equal(reopened.project.layouts[0].items[0].x,10);
 const recovered=await reopened.saveRecovery(reopened.project);
 const saved=await(await s.fetcher('/api/drafts/'+recovered.imported[0].id)).json();
 assert.equal(saved.layout.items[0].x,40);
 assert.equal((await(await s.fetcher('/api/drafts/draft')).json()).layout.items[0].x,10);
});
test('a lost save response can be retried without a false conflict or extra revision',async t=>{
 const s=setup(t);await s.create();const editor=await SharedEditor.open('draft');
 editor.project.layouts[0].items[0].x=50;editor.queue(editor.project);s.loseResponse();await editor.flush();
 assert.equal(editor.blocked,false);assert.notEqual(editor.pending,null);
 await editor.flush();assert.equal(editor.pending,null);assert.equal(editor.blocked,false);
 assert.equal(editor.known.get('draft').revision,2);assert.equal(s.values.has(editor.key),false);
});

