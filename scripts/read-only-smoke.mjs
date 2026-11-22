// Operational probes only. Never bundled into the Worker; every request is GET.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateWorkoutPublication} from '../worker/workout-api.mjs';

function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))??'undefined').digest('hex');
const bytesDigest=value=>createHash('sha256').update(value).digest('hex');
const idOK=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,120}$/.test(value);

function checkedOrigin(value){
  const url=new URL(value);
  const fixture=url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!fixture)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
    throw Error('Use an HTTPS origin or a loopback fixture origin, without credentials, path or query.');
  return url.origin;
}

export async function readOnlySmoke({origin,profile='candidate',expectedRole='owner',assets,
  draftIds=[],maxPages=4,timeoutMs=10_000,maxBytes=2*1024*1024,fetchImpl=globalThis.fetch}={}){
  origin=checkedOrigin(origin);
  if(!['baseline','candidate'].includes(profile)||!['owner','editor','publisher'].includes(expectedRole)||
      !Number.isSafeInteger(maxPages)||maxPages<1||maxPages>100||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||
      !Number.isSafeInteger(maxBytes)||maxBytes<1||!Array.isArray(draftIds)||draftIds.length>10||!draftIds.every(idOK))
    throw Error('Invalid smoke-check options.');
  const defaults=profile==='baseline'?['/workspace.html','/index.html','/map.html']:
    ['/workspace.html','/index.html','/map.html','/equipment-checklist.html','/equipment-catalog.mjs'];
  if(assets&&(profile!=='candidate'||!assets||typeof assets!=='object'||Array.isArray(assets)||
      !Object.keys(assets).length||Object.keys(assets).length>1000||
      defaults.some(path=>!assets[path])||
      Object.entries(assets).some(([path,entry])=>!/^\/[a-zA-Z0-9_.\/-]+$/.test(path)||path.startsWith('//')||path.includes('..')||
        path==='/api'||path.startsWith('/api/')||!entry||!/^[a-f0-9]{64}$/.test(entry.sha256)||typeof entry.content_type!=='string')))
    throw Error('Use the candidate static_assets manifest without API paths or traversal.');
  const report={format:'gym-readonly-verification-v1',observed_at:new Date().toISOString(),origin,profile,expected_role:expectedRole,
    reported_role:null,status:'blocked',checks:[],snapshot:{complete:false},
    limits:{full_database_backup:false,atomic_database_snapshot:false,migration_ledger_verified:false,platform_identity_verified:false,
      worker_byte_identity_verified:false,note:'Role is an HTTP observation. Verify the real signed-in identity separately. Metadata fingerprints are not a full backup.'}};
  function result(name,path,status,reason,httpStatus){
    const check={name,path:name==='selected_draft'?'/api/drafts/[selected]':path,status,...(reason?{reason}:{}),...(httpStatus?{http_status:httpStatus}:{})};report.checks.push(check);return check;
  }
  function finish(){report.status=report.checks.some(check=>check.status==='fail')?'failed':
    report.checks.some(check=>check.status==='blocked')||!report.snapshot.complete?'blocked':'passed';return report;}
  async function get(path,name,{json=true,expectedStatus=200,validate=()=>true,hash}={}){
    try{
      const target=new URL(path,origin);if(target.origin!==origin)throw Error('Invalid probe target.');
      const response=await fetchImpl(target,{method:'GET',redirect:'manual',credentials:'same-origin',
        cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
      if(response.redirected||response.url&&new URL(response.url).origin!==origin){result(name,path,'fail','redirected_response');return;}
      if(response.status>=300&&response.status<400){await response.body?.cancel();result(name,path,'blocked','gateway_redirect',response.status);return;}
      if(response.status!==expectedStatus){await response.body?.cancel();result(name,path,[401,403].includes(response.status)?'blocked':'fail','unexpected_status',response.status);return;}
      const type=response.headers.get('Content-Type')||'';
      if(json&&!/^application\/json\b/i.test(type)){await response.body?.cancel();result(name,path,'blocked','non_json_gateway_or_upstream',response.status);return;}
      const chunks=[];let count=0;const reader=response.body?.getReader();
      if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;
        if(count>maxBytes){await reader.cancel();result(name,path,'fail','response_too_large',response.status);return;}chunks.push(value);}}
      finally{reader.releaseLock();}
      const bytes=Buffer.concat(chunks),body=json?JSON.parse(bytes.toString('utf8')):bytes;
      if(!validate(body,type)||hash&&hash!==bytesDigest(bytes)){result(name,path,'fail','response_or_asset_mismatch',response.status);return;}
      result(name,path,'pass',null,response.status);return body;
    }catch{result(name,path,'blocked','network_timeout_or_unreadable_response');}
  }
  const session=await get('/api/session','staff_session',{validate:body=>
    body?.storage==='shared'&&['owner','editor','publisher'].includes(body?.user?.role)});
  if(!session)return finish();
  report.reported_role=session.user.role;
  if(session.user.role!==expectedRole){result('expected_staff_role','/api/session','fail','unexpected_role');return finish();}

  for(const path of assets?Object.keys(assets).sort():defaults){
    const entry=assets?.[path];
    await get(path,'static_asset',{json:false,hash:entry?.sha256,validate:(bytes,type)=>entry?
      type.split(';')[0]===entry.content_type.split(';')[0]:path.endsWith('.html')?/^text\/html\b/i.test(type):/^(text|application)\/javascript\b/i.test(type)});
  }
  report.asset_hashes_verified=!!assets&&report.checks.filter(check=>check.name==='static_asset').every(check=>check.status==='pass');
  const current=await get('/api/current','current_publication',{validate:body=>{
    if(body?.current===null)return true;
    try{validateWorkoutPublication({id:body?.current?.id,published_at:body?.current?.publishedAt},body?.current?.layout);return true;}
    catch{return false;}
  }});
  if(current)report.snapshot.current=current.current===null?{published:false}:{published:true,
    id_sha256:digest(current.current.id),layout_sha256:digest(current.current.layout),published_at:current.current.publishedAt};

  let complete=true;
  async function pages(path,key,name,validate){
    const rows=[],seen=new Set(),ids=new Set();let offset=0;
    for(let n=0;n<maxPages;n++){
      const separator=path.includes('?')?'&':'?';
      const body=await get(path+separator+'offset='+offset,name,{validate:body=>Array.isArray(body?.[key])&&body[key].every(validate)&&
        (body.nextOffset===null||Number.isSafeInteger(body.nextOffset)&&body.nextOffset>offset)});
      if(!body){complete=false;return rows;}
      if(body[key].some(row=>{if(ids.has(row.id))return true;ids.add(row.id);return false;})){
        result(name,path,'blocked','duplicate_identity_across_pages');complete=false;return rows;
      }
      rows.push(...body[key]);
      if(body.nextOffset===null)return rows;
      if(seen.has(body.nextOffset)){result(name,path,'fail','repeated_pagination');complete=false;return rows;}
      seen.add(body.nextOffset);offset=body.nextOffset;
    }
    result(name,path,'blocked','pagination_limit_reached');complete=false;return rows;
  }
  const validDraft=row=>idOK(row?.id)&&typeof row.name==='string'&&Number.isSafeInteger(row.revision)&&row.revision>=1&&typeof row.archived==='boolean';
  const active=await pages('/api/drafts?limit=50&archived=false','drafts','active_draft_metadata',row=>validDraft(row)&&!row.archived);
  const archived=await pages('/api/drafts?limit=50&archived=true','drafts','archived_draft_metadata',row=>validDraft(row)&&row.archived);
  const history=await pages('/api/history','history','publication_history',row=>idOK(row?.id)&&typeof row.publishedAt==='string');
  const draftMetadata=rows=>rows.map(row=>({id_sha256:digest(row.id),revision:row.revision,archived:row.archived,
    metadata_sha256:digest(row)})).sort((a,b)=>a.id_sha256.localeCompare(b.id_sha256));
  report.snapshot.active_drafts=draftMetadata(active);report.snapshot.archived_drafts=draftMetadata(archived);
  report.snapshot.history=history.map(row=>({id_sha256:digest(row.id),metadata_sha256:digest(row)})).sort((a,b)=>a.id_sha256.localeCompare(b.id_sha256));
  report.snapshot.selected_drafts=[];
  for(const id of [...new Set(draftIds)].sort()){
    const body=await get('/api/drafts/'+id,'selected_draft',{validate:body=>body?.layout?.id===id&&Number.isSafeInteger(body.revision)&&Array.isArray(body.library)});
    if(!body){complete=false;continue;}
    report.snapshot.selected_drafts.push({id_sha256:digest(id),document_sha256:digest(body)});
  }
  if(expectedRole==='owner'){
    const staff=await get('/api/staff','staff_roles',{validate:body=>Array.isArray(body?.staff)&&
      body.staff.every(row=>typeof row.email==='string'&&['editor','publisher'].includes(row.role))});
    if(staff)report.snapshot.staff_roles_sha256=digest([...staff.staff].sort((a,b)=>a.email.localeCompare(b.email)));
    else complete=false;
  }else{
    // GET only: editor/publisher denial must not be tested by attempting a write.
    await get('/api/staff','owner_controls_denied',{expectedStatus:403,validate:body=>typeof body?.error==='string'});
  }
  if(profile==='candidate')await get('/api/v1/layout','workout_integration_disabled',{expectedStatus:503,
    validate:body=>body?.apiVersion===1&&body?.error?.code==='integration_unavailable'});
  report.snapshot.complete=complete&&!!current&&report.checks.every(check=>check.status==='pass');
  return finish();
}

export function compareReadOnlyEvidence(before,after){
  if(before?.format!=='gym-readonly-verification-v1'||after?.format!==before.format||before.origin!==after.origin||before.expected_role!==after.expected_role)
    return {status:'failed',reason:'incompatible_evidence'};
  if(before.status!=='passed'||after.status!=='passed'||!before.snapshot?.complete||!after.snapshot?.complete)
    return {status:'blocked',reason:'incomplete_or_failed_checks'};
  const changed=Object.keys({...before.snapshot,...after.snapshot}).filter(key=>key!=='complete'&&digest(before.snapshot[key])!==digest(after.snapshot[key]));
  return {status:changed.length?'failed':'passed',changed_sections:changed,
    full_database_backup:false,note:'Compares captured metadata and selected document fingerprints only; it does not prove a database backup or migration ledger.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const options={},args=process.argv.slice(2);let before,assetFile;
  while(args.length){const flag=args.shift(),value=args.shift();if(!value)throw Error('Every option requires a value.');
    if(flag==='--origin')options.origin=value;else if(flag==='--profile')options.profile=value;
    else if(flag==='--expected-role')options.expectedRole=value;else if(flag==='--max-pages')options.maxPages=Number(value);
    else if(flag==='--draft-id')(options.draftIds??=[]).push(value);
    else if(flag==='--before')before=JSON.parse(await readFile(value,'utf8'));
    else if(flag==='--candidate')assetFile=resolve(value,'release.json');else throw Error('Unknown smoke-check option.');}
  if(assetFile){const metadata=JSON.parse(await readFile(assetFile,'utf8'));if(!metadata.static_assets)throw Error('Candidate predates asset fingerprints; prepare a current candidate.');options.assets=metadata.static_assets;}
  const report=await readOnlySmoke(options);
  if(before)report.preservation=compareReadOnlyEvidence(before,report);
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.status==='passed'&&(!report.preservation||report.preservation.status==='passed')?0:report.status==='failed'||report.preservation?.status==='failed'?1:2;
}
