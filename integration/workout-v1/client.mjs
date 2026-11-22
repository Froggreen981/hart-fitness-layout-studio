// Backend only. Copy this directory and install ajv@8 and ajv-formats@3.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from './response.schema.json' with {type:'json'};
import {indexPublishedEquipment} from './snapshot.mjs';

const ajv=new Ajv2020({strict:true});
addFormats(ajv);
ajv.addSchema(schema);
const validateLayout=ajv.compile({$ref:schema.$id+'#/$defs/layoutResponse'});
const validateError=ajv.compile({$ref:schema.$id+'#/$defs/errorResponse'});

export class GymApiError extends Error {
  constructor(code,status=0){super('Gym layout unavailable ('+code+').');this.name='GymApiError';this.code=code;this.status=status;}
}

async function jsonBody(response,maxBytes){
  if(!/^application\/json\b/i.test(response.headers.get('Content-Type')||''))throw new GymApiError('invalid_response',response.status);
  const reader=response.body?.getReader();
  if(!reader)throw new GymApiError('invalid_response',response.status);
  const chunks=[];let bytes=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
      if(bytes>maxBytes)throw new GymApiError('response_too_large',response.status);chunks.push(value);}
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new GymApiError('invalid_response',response.status);}
}

export function createGymClient({gymOrigin,workoutToken,siteServiceToken,fetchImpl=globalThis.fetch,timeoutMs=10_000,maxBytes=8*1024*1024}){
  const origin=new URL(gymOrigin);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')
    throw new Error('gymOrigin must be a credential-free HTTPS origin.');
  if(!/^[A-Za-z0-9_-]{43}$/.test(workoutToken||''))throw new Error('A backend workout token is required.');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||!Number.isSafeInteger(maxBytes)||maxBytes<1)
    throw new Error('Use positive integer timeout/response limits.');
  const url=new URL('/api/v1/layout',origin);
  // Each instance is permanently scoped to one origin and credential context.
  let cached,pending;
  async function load(){
    try{
      const validator=cached?.etag;
      const response=await fetchImpl(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs),headers:{
        Accept:'application/json',Authorization:'Bearer '+workoutToken,
        ...(siteServiceToken?{'OAI-Sites-Authorization':'Bearer '+siteServiceToken}:{}),
        ...(validator?{'If-None-Match':validator}:{})
      }});
      const responseTag=response.headers.get('ETag');
      const noStore=/(?:^|,)\s*no-store\s*(?=,|$)/i.test(response.headers.get('Cache-Control')||'');
      if(response.status===304){
        if(!cached||!validator)throw new GymApiError('unexpected_304',304);
        if(responseTag&&responseTag.replace(/^W\//,'')!==validator.replace(/^W\//,''))throw new GymApiError('invalid_revalidation',304);
        const body=cached.body;if(noStore)cached=undefined;return body;
      }
      const body=await jsonBody(response,maxBytes);
      if(response.status===404&&validateError(body)&&body.error.code==='no_publication'){cached=undefined;return null;}
      if(response.status!==200){
        const code=validateError(body)?body.error.code:'upstream_failure';
        throw new GymApiError(code,response.status);
      }
      if(!validateLayout(body))throw new GymApiError('invalid_response',200);
      try{indexPublishedEquipment(body);}catch{throw new GymApiError('ambiguous_equipment',200);}
      const etag=/^(?:W\/)?"[^"\r\n]*"$/.test(responseTag||'')?responseTag:null;
      cached=noStore?undefined:{body,etag};
      return body;
    }catch(error){
      // Never serve stale equipment after a network/authentication/gateway failure.
      cached=undefined;
      if(error instanceof GymApiError)throw error;
      throw new GymApiError('upstream_failure');
    }
  }
  return {async getLayout(){
    // Coalesce simultaneous callers and protect the private cached object from callers.
    pending??=load().finally(()=>{pending=undefined;});
    return structuredClone(await pending);
  }};
}

export function resolveWorkoutEquipment(snapshot,{publicationId,equipmentIds}){
  if(!snapshot?.publication?.id||!Array.isArray(snapshot.layout?.equipment)||typeof publicationId!=='string'||
      !Array.isArray(equipmentIds)||!equipmentIds.every(id=>typeof id==='string'))throw new Error('Use a snapshot and explicit workout instance IDs.');
  const byId=indexPublishedEquipment(snapshot);
  return {publicationChanged:publicationId!==snapshot.publication.id,publicationId:snapshot.publication.id,
    equipment:[...new Set(equipmentIds)].map(id=>{
      const item=byId.get(id);
      return {id,status:item?.status??'missing',...(item?{equipment:structuredClone(item)}:{})};
    })};
}
