import {roomPoints,wallPolygons,itemPoints,size} from './model.mjs';
import {request,escapeHTML as esc} from './shared-api.mjs';
const $=id=>document.getElementById(id);
let publication=null,selected=null,running=false;
const colors={cardio:'#dce8f4',strength:'#dce5ec',free:'#eee4cf',obstacle:'#d1d5d8',area:'#edf2f5'};
function select(id){
 selected=id;
 const item=publication.layout.items.find(i=>i.id===id);if(!item)return;
 $('equipmentDetails').textContent=item.name+(item.status==='out-of-service'?' · Out of service':'');
 document.querySelectorAll('[data-equipment]').forEach(el=>{const yes=el.dataset.equipment===id;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',String(yes));if(el.tagName.toLowerCase()==='polygon'){el.setAttribute('stroke',yes?'#0062a5':'#657d8f');el.setAttribute('stroke-width',yes?'.5':'.12');}});
}
function render(){
 const layout=publication.layout,room=layout.room;
 $('mapName').textContent=layout.name;$('publishedAt').textContent='Updated '+new Date(publication.publishedAt).toLocaleString();
 $('publicMap').setAttribute('viewBox','-3 -3 '+(room.width+6)+' '+(room.length+6));
 let svg='<polygon points="'+roomPoints(room).map(p=>p.join(',')).join(' ')+'" fill="white" stroke="#172b3a" stroke-width=".6"/>';
 for(const wall of room.walls||[])for(const polygon of wallPolygons(wall))svg+='<polygon points="'+polygon.map(p=>p.join(',')).join(' ')+'" fill="'+(wall.type==='half'?'#9a9fa5':'#172b3a')+'"><title>'+esc(wall.name)+'</title></polygon>';
 const list=layout.items.filter(i=>!['area','obstacle'].includes(i.category));
 for(const item of layout.items){
  const equipment=list.includes(item),points=itemPoints(item).map(p=>p.join(',')).join(' ');
  svg+='<polygon points="'+points+'" fill="'+(item.category==='area'?item.color||colors.area:colors[item.category]||colors.strength)+'" fill-opacity="'+(item.category==='area'?'.15':'1')+'" stroke="#657d8f" stroke-width=".12"'+(equipment?' data-equipment="'+esc(item.id)+'" role="button" tabindex="0" aria-pressed="false" aria-label="'+esc(item.name+(item.status==='out-of-service'?', out of service':''))+'"':'')+'><title>'+esc(item.name)+'</title></polygon>';
  if(item.category==='area'){
   const label=item.label||{x:.5,y:.5,rotation:0},[w,h]=size(item),a=item.rotation*Math.PI/180,dx=(label.x-.5)*item.width,dy=(label.y-.5)*item.length;
   const x=item.x+w/2+dx*Math.cos(a)-dy*Math.sin(a),y=item.y+h/2+dx*Math.sin(a)+dy*Math.cos(a);
   svg+='<text transform="translate('+x+' '+y+') rotate('+(item.rotation+label.rotation)+')" text-anchor="middle" font-size="1.4" fill="#466174" pointer-events="none">'+esc(item.name)+'</text>';
  }
 }
 $('publicMap').innerHTML=svg;
 $('equipmentList').innerHTML=list.length?list.map(i=>'<button data-equipment="'+esc(i.id)+'" aria-pressed="false">'+esc(i.name)+(i.status==='out-of-service'?' (unavailable)':'')+'</button>').join(''):'<p>No equipment is listed on this published map.</p>';
 if(selected)select(selected);
}
async function refresh(){
 if(running)return;running=true;
 try{const data=await request('/api/current');
 if(!data.current){publication=null;$('mapStatus').textContent='Staff have not published a current gym layout yet.';$('publicMap').innerHTML='';$('equipmentList').innerHTML='';return;}
 if(data.current.id!==publication?.id){publication=data.current;render();}
 $('mapStatus').textContent='';
 }catch(e){$('mapStatus').textContent=publication?'Unable to refresh. Showing the arrangement published '+new Date(publication.publishedAt).toLocaleString()+'.':e.message;}finally{running=false;}
}
$('publicMap').onclick=e=>{const el=e.target.closest('[data-equipment]');if(el)select(el.dataset.equipment);};
$('publicMap').onkeydown=e=>{if(!['Enter',' '].includes(e.key))return;const el=e.target.closest('[data-equipment]');if(el){e.preventDefault();select(el.dataset.equipment);}};
$('equipmentList').onclick=e=>{const el=e.target.closest('[data-equipment]');if(el)select(el.dataset.equipment);};
$('refreshMap').onclick=refresh;window.addEventListener('focus',refresh);
setInterval(()=>{if(!document.hidden)refresh();},60000);
await refresh();

