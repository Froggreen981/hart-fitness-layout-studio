export async function request(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
 if(!response.ok){const error=new Error(data.error||'Request failed.');error.status=response.status;error.details=data;throw error;}
 return data;
}
export const send=(path,data,method='POST')=>request(path,{method,body:JSON.stringify(data)});
export const escapeHTML=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const editLink=id=>'index.html?draft='+encodeURIComponent(id);

