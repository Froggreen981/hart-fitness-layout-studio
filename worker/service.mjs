import {validateProject} from '../dist/model.mjs';
const MAX_BYTES=6*1024*1024;
const idOK=v=>typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(v);
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
class HttpError extends Error{constructor(status,message,details={}){super(message);this.status=status;this.details=details;}}
const fail=(status,message,details)=>{throw new HttpError(status,message,details);};
const normalizeEmail=v=>String(v||'').trim().toLowerCase();
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
async function body(request){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail(415,'Send JSON data.');
  if(Number(request.headers.get('content-length'))>MAX_BYTES)fail(413,'Import is too large. Split it into smaller files.');
  const reader=request.body?.getReader();let total=0,chunks=[];
  if(!reader)fail(400,'Missing request data.');
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();fail(413,'Import is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,'Invalid JSON.');}
}
function safeProject(p){
  try{const valid=validateProject(p);if(valid.layouts.some(l=>!idOK(l.id)))fail(400,'Invalid layout identifier.');return valid;}
  catch(e){if(e instanceof HttpError)throw e;fail(400,e.message);}
}
function documentFor(layout,library=[]){
  if(!layout||!idOK(layout.id))fail(400,'Invalid layout identifier.');
  const p=safeProject({version:2,active:layout.id,layouts:[layout],library});
  if(!p.layouts[0].name.trim())fail(400,'Enter a layout name.');
  const doc={layout:p.layouts[0],library:p.library||[]};
  if(JSON.stringify(doc).length>1500000)fail(413,'This layout is too large.');
  return doc;
}
const take=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
export function publicLayout(layout){
  const room=take(layout.room,['width','length','shape','innerWidth','upperLength','boundary','points','outline','vertices']);
  if(layout.room.walls)room.walls=layout.room.walls.map(w=>({...take(w,['name','type','x1','x2','y1','y2','thickness']),...(w.projections?{projections:w.projections.map(p=>take(p,['x1','x2','y1','y2','thickness']))}:{})}));
  if(layout.room.zones)room.zones=layout.room.zones.map(z=>take(z,['name','x','y','angle']));
  return {name:layout.name,room,items:layout.items.filter(i=>!i.storedIn).map(i=>({...take(i,['id','kind','category','x','y','width','length','rotation','color','placement','vertices','label']),name:i.publicName||i.name,status:i.status==='out-of-service'?'out-of-service':'available'}))};
}
async function identity(request,env){
  const email=normalizeEmail(request.headers.get('oai-authenticated-user-email'));
  const userId=request.headers.get('oai-authenticated-user-id');
  if(!userId||!email)fail(401,'Sign in to use staff layouts.');
  const owner=normalizeEmail(env.STAFF_OWNER_EMAIL);
  if(!owner)fail(503,'Staff access needs to be configured by the site owner.');
  if(email===owner)return {email,id:userId,role:'owner'};
  const member=await stmt(env.DB,'SELECT role FROM gym_staff WHERE email = ?',email).first();
  if(!member)fail(403,'Your account has not been added to the gym staff workspace.');
  return {email,id:userId,role:member.role};
}
const canPublish=user=>{if(!['owner','publisher'].includes(user.role))fail(403,'Publishing permission is required.');};
const expectRevision=v=>{if(!Number.isSafeInteger(v)||v<1)fail(400,'A valid saved revision is required.');};
const operationId=v=>{if(!idOK(v))fail(400,'A request identifier is required.');return v;};
const expectedCurrent=v=>{if(v!==null&&!idOK(v))fail(400,'The current publication must be specified.');return v||'';};
const draftResult=row=>({...JSON.parse(row.document_json),revision:row.revision,archived:!!row.archived,updatedAt:row.updated_at});
const pubMeta=row=>row?{id:row.id,sourceDraftId:row.source_draft_id,sourceRevision:row.source_revision,restoredFrom:row.restored_from,previousId:row.previous_id,publishedAt:row.published_at}:null;
async function getDraft(db,id){const row=await stmt(db,'SELECT * FROM gym_drafts WHERE id = ?',id).first();if(!row)fail(404,'Layout not found.');return row;}
async function current(db){return db.prepare('SELECT * FROM gym_publications ORDER BY sequence DESC LIMIT 1').first();}
function sameOrigin(request){
  const origin=request.headers.get('origin');
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Use the gym site to make this change.');
}
export async function api(request,env){
 try{
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  if(!env.DB)fail(503,'Shared storage is not connected. Browser layouts remain available in the original planner.');
  if(request.method==='GET'&&path==='/api/current'){
    const row=await current(env.DB);
    if(!row)return json({current:null});
    const tag='"'+row.id+'"';
    if(request.headers.get('if-none-match')===tag)return new Response(null,{status:304,headers:{ETag:tag,'Cache-Control':'no-cache'}});
    return json({current:{id:row.id,publishedAt:row.published_at,layout:JSON.parse(row.public_json)}},200,{ETag:tag,'Cache-Control':'no-cache'});
  }
  const user=await identity(request,env);
  if(!['GET','HEAD'].includes(request.method))sameOrigin(request);
  if(path==='/api/session'&&request.method==='GET')return json({user:{email:user.email,role:user.role},storage:'shared'});
  if(path==='/api/staff'){
    if(user.role!=='owner')fail(403,'Only the owner can manage staff access.');
    if(request.method==='GET')return json({staff:(await env.DB.prepare('SELECT email,role FROM gym_staff ORDER BY email').all()).results});
    if(request.method==='POST'){const p=await body(request),email=normalizeEmail(p.email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['editor','publisher'].includes(p.role))fail(400,'Enter an email and staff role.');
      if(email===normalizeEmail(env.STAFF_OWNER_EMAIL))fail(400,'The owner already has access.');
      await stmt(env.DB,'INSERT INTO gym_staff (email,role,created_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role',email,p.role,new Date().toISOString()).run();return json({email,role:p.role});}
    if(request.method==='DELETE'){const p=await body(request);await stmt(env.DB,'DELETE FROM gym_staff WHERE email = ?',normalizeEmail(p.email)).run();return json({removed:true});}
  }
  if(path==='/api/drafts'&&request.method==='GET'){
    const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit'))||25)),offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
    const archived=url.searchParams.get('archived')==='true'?1:0;
    const results=(await stmt(env.DB,'SELECT id,name,revision,archived,updated_at FROM gym_drafts WHERE archived = ? ORDER BY updated_at DESC,id LIMIT ? OFFSET ?',archived,limit+1,offset).all()).results;
    return json({drafts:results.slice(0,limit).map(r=>({id:r.id,name:r.name,revision:r.revision,archived:!!r.archived,updatedAt:r.updated_at})),nextOffset:results.length>limit?offset+limit:null,current:pubMeta(await current(env.DB))});
  }
  if(path==='/api/drafts/from-current'&&request.method==='POST'){
    const p=await body(request),row=await current(env.DB);
    if(!row)fail(404,'No current gym layout is published.');
    if(p.expectedCurrentId!==row.id)fail(409,'The current gym changed. Reload before making a draft.');
    const source=JSON.parse(row.document_json),id=crypto.randomUUID();
    const doc=documentFor({...source.layout,id,name:(source.layout.name+' draft').slice(0,100)},source.library);
    await stmt(env.DB,'INSERT INTO gym_drafts(id,name,document_json,updated_at,updated_by) VALUES(?,?,?,?,?)',id,doc.layout.name,JSON.stringify(doc),new Date().toISOString(),user.email).run();
    return json({...doc,revision:1,archived:false},201);
  }
  if(path==='/api/drafts'&&request.method==='POST'){
    const p=await body(request),id=p.layout?.id||crypto.randomUUID();
    const doc=documentFor({...p.layout,id},p.library);
    const result=await stmt(env.DB,'INSERT OR IGNORE INTO gym_drafts (id,name,document_json,updated_at,updated_by) VALUES (?,?,?,?,?)',id,doc.layout.name,JSON.stringify(doc),new Date().toISOString(),user.email).run();
    if(!result.meta.changes){const old=await getDraft(env.DB,id);if(old.revision===1&&old.updated_by===user.email&&old.document_json===JSON.stringify(doc))return json(draftResult(old));fail(409,'A layout with that identifier already exists.');}
    return json({...doc,revision:1,archived:false},201);
  }
  if(path==='/api/import'&&request.method==='POST'){
    const p=await body(request),requestId=operationId(p.requestId),existing=await stmt(env.DB,'SELECT result_json FROM gym_imports WHERE request_id = ?',requestId).first();
    if(existing)return json(JSON.parse(existing.result_json));
    const project=safeProject(p.project),now=new Date().toISOString(),token=crypto.randomUUID();
    const docs=project.layouts.map(l=>documentFor({...l,id:crypto.randomUUID()},project.library));
    const result={imported:docs.map(d=>({id:d.layout.id,name:d.layout.name}))};
    await env.DB.batch([
      stmt(env.DB,'INSERT OR IGNORE INTO gym_imports(request_id,token,result_json,created_at) VALUES (?,?,?,?)',requestId,token,JSON.stringify(result),now),
      ...docs.map(d=>stmt(env.DB,'INSERT INTO gym_drafts(id,name,document_json,updated_at,updated_by) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM gym_imports WHERE request_id = ? AND token = ?)',d.layout.id,d.layout.name,JSON.stringify(d),now,user.email,requestId,token))
    ]);
    return json(JSON.parse((await stmt(env.DB,'SELECT result_json FROM gym_imports WHERE request_id = ?',requestId).first()).result_json),201);
  }
  const draftMatch=path.match(/^\/api\/drafts\/([a-zA-Z0-9_.-]+)(?:\/(archive|publish))?$/);
  if(draftMatch){
    const [,id,action]=draftMatch,row=await getDraft(env.DB,id);
    if(!action&&request.method==='GET')return json(draftResult(row));
    if(!action&&request.method==='PUT'){
      const p=await body(request);expectRevision(p.expectedRevision);
      if(row.archived)fail(409,'Restore this archived layout before editing.');
      const doc=documentFor({...p.layout,id},p.library);
      const result=await stmt(env.DB,'UPDATE gym_drafts SET name=?,document_json=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND archived=0',doc.layout.name,JSON.stringify(doc),new Date().toISOString(),user.email,id,p.expectedRevision).run();
      if(!result.meta.changes){const latest=await getDraft(env.DB,id);if(latest.revision===p.expectedRevision+1&&latest.updated_by===user.email&&latest.document_json===JSON.stringify(doc))return json(draftResult(latest));fail(409,'Another staff member saved a newer version. Your changes are still recoverable.',{revision:latest.revision});}
      return json({...doc,revision:p.expectedRevision+1,archived:false});
    }
    if(action==='archive'&&request.method==='POST'){
      const p=await body(request);expectRevision(p.expectedRevision);
      if(typeof p.archived!=='boolean')fail(400,'Choose archive or restore.');
      const result=await stmt(env.DB,'UPDATE gym_drafts SET archived=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?',p.archived?1:0,new Date().toISOString(),user.email,id,p.expectedRevision).run();
      if(!result.meta.changes)fail(409,'The layout changed. Reload before archiving or restoring.');
      return json(draftResult(await getDraft(env.DB,id)));
    }
    if(action==='publish'&&request.method==='POST'){
      canPublish(user);const p=await body(request);expectRevision(p.expectedRevision);
      if(p.confirmActual!==true)fail(400,'Confirm that this arrangement matches the physical gym.');
      const requestId=operationId(p.requestId),previous=expectedCurrent(p.expectedCurrentId);
      const old=await stmt(env.DB,'SELECT * FROM gym_publications WHERE id = ?',requestId).first();
      if(old){if(old.source_draft_id!==id||old.source_revision!==p.expectedRevision||old.previous_id!==(previous||null))fail(409,'This request identifier was already used.');return json({current:pubMeta(old)});}
      if(row.revision!==p.expectedRevision)fail(409,'The draft changed. Reload before publishing.');
      const doc=JSON.parse(row.document_json);
      const result=await stmt(env.DB,`INSERT OR IGNORE INTO gym_publications(id,source_draft_id,source_revision,previous_id,document_json,public_json,published_at,published_by)
        SELECT ?,id,revision,?,document_json,?,?,? FROM gym_drafts
        WHERE id=? AND revision=? AND archived=0 AND COALESCE((SELECT id FROM gym_publications ORDER BY sequence DESC LIMIT 1),'')=?`,
        requestId,previous||null,JSON.stringify(publicLayout(doc.layout)),new Date().toISOString(),user.email,id,p.expectedRevision,previous).run();
      if(!result.meta.changes)fail(409,'The draft or current gym changed. Reload and review before publishing.');
      return json({current:pubMeta(await stmt(env.DB,'SELECT * FROM gym_publications WHERE id = ?',requestId).first())},201);
    }
  }
  if(path==='/api/history'&&request.method==='GET'){
    const limit=25,offset=Math.max(0,Number(url.searchParams.get('offset'))||0);
    const rows=(await stmt(env.DB,'SELECT id,source_draft_id,source_revision,restored_from,previous_id,published_at FROM gym_publications ORDER BY sequence DESC LIMIT ? OFFSET ?',limit+1,offset).all()).results;
    return json({history:rows.slice(0,limit).map(pubMeta),nextOffset:rows.length>limit?offset+limit:null});
  }
  const restore=path.match(/^\/api\/history\/([a-zA-Z0-9_.-]+)\/restore$/);
  if(restore&&request.method==='POST'){
    canPublish(user);const p=await body(request);if(p.confirmActual!==true)fail(400,'Confirm that this historical layout matches the physical gym.');
    const requestId=operationId(p.requestId),previous=expectedCurrent(p.expectedCurrentId);
    const selected=await stmt(env.DB,'SELECT * FROM gym_publications WHERE id = ?',restore[1]).first();if(!selected)fail(404,'Publication not found.');
    const old=await stmt(env.DB,'SELECT * FROM gym_publications WHERE id = ?',requestId).first();
    if(old){if(old.restored_from!==restore[1]||old.previous_id!==(previous||null))fail(409,'This request identifier was already used.');return json({current:pubMeta(old)});}
    const result=await stmt(env.DB,`INSERT INTO gym_publications(id,source_draft_id,source_revision,restored_from,previous_id,document_json,public_json,published_at,published_by)
      SELECT ?,source_draft_id,source_revision,?, ?,document_json,public_json,?,? FROM gym_publications
      WHERE id=? AND COALESCE((SELECT id FROM gym_publications ORDER BY sequence DESC LIMIT 1),'')=?`,
      requestId,restore[1],previous||null,new Date().toISOString(),user.email,restore[1],previous).run();
    if(!result.meta.changes)fail(409,'The current gym changed. Reload before restoring.');
    return json({current:pubMeta(await stmt(env.DB,'SELECT * FROM gym_publications WHERE id = ?',requestId).first())},201);
  }
  fail(404,'Endpoint not found.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message,...e.details},e.status);console.error('Gym API failure',e.message);return json({error:'Shared storage could not complete this request. Your browser recovery copy is retained.'},500);}
}

