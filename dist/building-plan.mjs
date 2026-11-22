import {polygonBounds,resizeRoom,itemPoints} from './model.mjs';

export const BUILDING_PLAN_ID='hart-building-plan-2024-v1';
export const BUILDING_PLAN_REVISION=3;
const buffers=()=>({front:0,rear:0,left:0,right:0});

// Estimated from the supplied February 2024 lower-level drawing. The main
// square is about 155 ft across. The CrossFit room's 1,261 sq ft annotation
// provides a scale cross-check, since a PDF can be resized when printed.
// Coordinates follow the screenshot, with its upper-left gym corner at 0,0.
// Jackson's marked-up drawing confirms the square lower-right exterior and
// just three physical half walls. Dashed area divisions are not walls.

function projection(x1,y1,x2,y2,thickness=.5){return {x1,y1,x2,y2,thickness};}
function wall(name,x1,y1,x2,y2,type='half',projections=[]){
  return {name,x1,y1,x2,y2,type,thickness:type==='full'?.75:.5,
    ...(projections.length?{projections}:{})};
}
function area(name,points,label,placement='allowed',color='#88a5bc'){
  const b=polygonBounds(points);
  return {id:BUILDING_PLAN_ID+'-'+name.toLowerCase().replace(/\s+/g,'-'),name,
    category:'area',kind:'area',x:b.x,y:b.y,width:b.w,length:b.h,
    vertices:points.map(([x,y])=>[(x-b.x)/b.w,(y-b.y)/b.h]),
    rotation:0,buffer:0,buffers:buffers(),locked:false,color,placement,
    label:{x:(label[0]-b.x)/b.w,y:(label[1]-b.y)/b.h,rotation:label[2]||0}};
}

export function buildingPlan(){
  return {id:BUILDING_PLAN_ID,name:'Hart building plan',room:{
    width:180,length:155,shape:'polygon',mainWidth:155,
    planReference:'hart-lower-level-2024',planRevision:BUILDING_PLAN_REVISION,estimated:true,areasMigrated:true,
    vertices:[[0,0],[155,0],[155,4],[180,4],[180,59],[155,59],
      [155,155],[0,155]],
    walls:[
      // The hinged man door above the entry is blocked in daily use. The
      // larger opening below it spans roughly 10 ft on the estimated scale.
      wall('CrossFit shared wall, upper (man door blocked)',155,4,155,37,'full',
        [10.5,19.5,27.5].map(y=>projection(155,y,158.5,y,1.5))),
      wall('CrossFit shared wall, lower',155,47,155,59,'full'),
      wall('West wall projections',0,0,0,155,'full',
        [6.2,12.4,18.7,25,31.2,38.3,120,126,132.5,140.7,147.9].map(y=>projection(0,y,4,y))),
      wall('Lobby south wall projections',0,155,41.5,155,'full',
        [20.5,27.5,34.5].map(x=>projection(x,155,x,148))),
      wall('Lobby top half wall',0,112.5,31.5,112.5,'half',[
        projection(3.5,112.5,3.5,111),projection(3.5,111,9,111),projection(9,111,9,112.5),
        projection(31.5,112.5,32.5,111.5)]),
      wall('Lobby right half wall',41.5,155,41.5,124,'half',[
        projection(41.5,124,43.6,122),projection(43.6,122,44.6,123)]),
      wall('Walkway / cardio half wall',49,116.5,82.8,83.2,'half',[
        projection(49,116.5,50,117.5),projection(63.8,101.9,64.8,102.9),
        projection(74.7,91.2,75.7,92.2),projection(82.8,83.2,85.5,83.2),
        projection(85.5,83.2,85.5,84.5)])
    ]},items:[
      area('Dumbbells',[[0,0],[57.2,0],[57.2,63.2],[63,63.2],[63,64.5],[0,64.5]],[28,29]),
      area('Plate loaded',[[57.2,0],[131,0],[131,63.2],[57.2,63.2]],[94,34]),
      area('Classroom',[[131,0],[155,0],[155,35.4],[131,35.4]],[143,18], 'allowed','#7795b6'),
      area('CrossFit',[[156.5,4.5],[180,4.5],[180,58],[156.5,58]],[168.25,34]),
      area('Circuit area',[[0,65.5],[62.5,65.5],[62.5,81.5],[56,88.4],[41.7,103],[31.5,112],[0,112]],[27,88]),
      area('Squat racks',[[108,83.5],[130.3,83.5],[130.3,108],[108,108]],[119,95]),
      area('Cable',[[139.8,35.8],[155,35.8],[155,109.58],[130.8,109.58],[131.3,83],[131.3,73],[139.8,59.3]],[146,82,90]),
      area('Cardio',[[83,83.5],[108,83.5],[108,108.5],[130.3,108.5],[130.3,155],[41.8,155],[41.8,124],[49.5,117]],[86,130]),
      area('Lobby',[[0,113],[31.5,113],[41,124],[41,155],[0,155]],[19,134],'keep-clear','#68a67c'),
      area('Walkway',[[41.5,123],[49,116],[82.8,82.8],[92.5,82.8],[130.5,82.8],[130.5,73],[126,73],[71.7,73],[64,81.5],[56,88.5],[41.7,103],[31.5,112.5]],[67,91,-45],'keep-clear','#68a67c')
    ]};
}

// The obsolete arc is used only to recognize untouched generated area shapes.
// Custom contours, labels, equipment and storage must survive the correction.
function previousCornerAreas(){
  const round=n=>Math.round(n*100)/100;
  const curve=Array.from({length:17},(_,n)=>{
    const a=(-80-114*n/16)*Math.PI/180;
    return [round(148.5+37*Math.cos(a)),round(146+37*Math.sin(a))];
  });
  curve[0]=[155,109.58];curve[curve.length-1]=[112.6,155];
  return [
    area('Cable',[[139.8,35.8],[155,35.8],...curve.filter(([x])=>x>=130.5),[130.8,114],[131.3,83],[131.3,73],[139.8,59.3]],[146,82,90]),
    area('Cardio',[[83,83.5],[108,83.5],[108,108.5],[130.3,108.5],[130.3,114.5],...curve.filter(([x])=>x<130.5),[41.8,155],[41.8,124],[49.5,117]],[86,130])
  ];
}
export function upgradeBuildingPlan(project){
  let changed=false;
  for(const layout of project.layouts){
    const room=layout.room;
    const previousRevision=room?.planRevision||1;
    if(room?.planReference!=='hart-lower-level-2024'||previousRevision>=BUILDING_PLAN_REVISION)continue;
    const corrected=buildingPlan();
    let correctedRoom=corrected.room;
    for(const key of ['width','length'])if(room[key]!==correctedRoom[key])correctedRoom=resizeRoom(correctedRoom,key,room[key]);
    if(previousRevision>=2){
      // Correct the CrossFit entry and add the traced wall projections.
      // Preserve other measured wall coordinates, areas, equipment and storage.
      const replaceWall=w=>w.name.startsWith('CrossFit shared wall,')||
        ['West wall projections','Lobby south wall projections'].includes(w.name);
      const halfWalls=new Map(correctedRoom.walls.filter(w=>w.type==='half').map(w=>[w.name,w]));
      layout.room={...room,planRevision:BUILDING_PLAN_REVISION,
        walls:[...correctedRoom.walls.filter(replaceWall),...(room.walls||[]).filter(w=>!replaceWall(w)).map(w=>
          halfWalls.has(w.name)?{...w,projections:structuredClone(halfWalls.get(w.name).projections)}:w)]};
      changed=true;
      continue;
    }
    layout.room={...room,...correctedRoom};
    for(const previous of previousCornerAreas()){
      const item=layout.items.find(i=>i.id===previous.id&&i.category==='area');
      if(!item)continue;
      const points=itemPoints(item),oldPoints=itemPoints(previous);
      if(points.length!==oldPoints.length||points.some((p,n)=>p.some((v,k)=>Math.abs(v-oldPoints[n][k])>1e-8)))continue;
      const next=corrected.items.find(i=>i.id===item.id);
      if(item.label)item.label={...item.label,
        x:Math.max(0,Math.min(1,(item.x+item.width*item.label.x-next.x)/next.width)),
        y:Math.max(0,Math.min(1,(item.y+item.length*item.label.y-next.y)/next.length))};
      for(const key of ['x','y','width','length','vertices'])item[key]=structuredClone(next[key]);
    }
    changed=true;
  }
  return changed;
}

// Install a separate reference arrangement once. Saved work is never rescaled
// or overwritten, and a deleted reference arrangement stays deleted.
export function installBuildingPlan(project,{activate=true}={}){
  if(project.buildingPlanInstalled)return false;
  if(project.layouts.some(l=>l.id===BUILDING_PLAN_ID)){
    project.buildingPlanInstalled=true;
    return false;
  }
  const plan=buildingPlan();
  project.layouts.push(plan);
  project.buildingPlanInstalled=true;
  if(activate)project.active=plan.id;
  return true;
}
