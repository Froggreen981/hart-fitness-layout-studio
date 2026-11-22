import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildingPlan,installBuildingPlan,upgradeBuildingPlan,BUILDING_PLAN_ID,BUILDING_PLAN_REVISION} from './dist/building-plan.mjs';
import {inspect,validateProject,roomArea,roomPoints,resizeRoom,pointInside,itemPoints,wallPolygons} from './dist/model.mjs';

const plan=buildingPlan();
const machine={id:'machine',name:'Bench',kind:'bench',category:'free',x:80,y:30,width:2,length:5,rotation:0,buffer:0,buffers:{front:0,rear:0,left:0,right:0},locked:false};
const messages=(x,y,extra={})=>inspect([{...machine,x,y,...extra}],plan.room).get('machine');
const project={version:2,active:plan.id,layouts:[plan]};
assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))).layouts[0],plan);
assert.equal(plan.room.width,180);
assert.equal(plan.room.length,155);
assert.equal(roomArea(plan.room),25400);
assert.ok(!plan.items.some(i=>/spinning/i.test(i.name)));
assert.ok(pointInside([145,140],roomPoints(plan.room)));
assert.deepEqual(roomPoints(plan.room).slice(-3),[[155,59],[155,155],[0,155]],'the exterior meets at a square lower-right corner');
assert.equal(messages(140,140).length,0,'the former cutout is inside the rectangular exterior');
assert.equal(messages(152,150).length,0,'equipment may touch the bottom wall inside the square corner');
assert.ok(messages(154,150).includes('Outside room'),'the exterior right boundary still excludes equipment beyond it');
assert.ok(messages(165,80).includes('Outside room'),'space below CrossFit is outside');
assert.equal(messages(165,20).length,0,'CrossFit is part of the floor');
assert.equal(messages(80,30).length,0,'free-weight floor remains usable');
assert.equal(messages(108,134).length,0,'the lower floor remains usable');
assert.ok(messages(154,10).includes('Wall conflict'),'CrossFit shared wall remains physical');
assert.ok(messages(154,29,{width:2,length:3}).includes('Wall conflict'),'the hinged man door is blocked');
assert.equal(messages(153,38,{width:4,length:8}).length,0,'the wider lower entry is open between the gym and CrossFit');
assert.ok(messages(154,35,{width:2,length:3}).includes('Wall conflict'),'the wall above the main entry remains physical');
assert.ok(messages(154,46,{width:2,length:3}).includes('Wall conflict'),'the wall below the main entry remains physical');
for(const [x,y] of [[156.5,19],[1,12],[20,150],[64,102]])assert.ok(messages(x,y,{width:1,length:1}).includes('Wall conflict'),'wall projections block equipment');
assert.equal(messages(157.5,14,{width:1,length:1}).length,0,'the space between CrossFit projections remains usable');
assert.equal(messages(4.5,12.4,{width:1,length:1}).length,0,'space beyond a west-wall projection remains usable');
const projectionWall=plan.room.walls.find(w=>w.name==='West wall projections');
assert.equal(wallPolygons(projectionWall).length,12,'all wall projections render and participate in checks');
for(const projections of [[{x1:0,y1:1,x2:2,y2:1,thickness:NaN}],{},[{x1:-1,y1:1,x2:2,y2:1,thickness:.5}]])assert.throws(()=>validateProject({...project,layouts:[{...plan,room:{...plan.room,walls:[{...projectionWall,projections}]}}]}));
assert.ok(messages(151,149,{buffer:4,buffers:{front:4,rear:4,left:4,right:4}}).includes('Planning buffer outside room'),'buffers still check the real exterior');
assert.deepEqual(plan.room.walls.filter(w=>w.type==='half').map(w=>[w.name,w.x1,w.y1,w.x2,w.y2]),[
  ['Lobby top half wall',0,112.5,31.5,112.5],
  ['Lobby right half wall',41.5,155,41.5,124],
  ['Walkway / cardio half wall',49,116.5,82.8,83.2]
]);
for(const [x,y] of [[10,111],[40,130],[65,98]])assert.ok(messages(x,y).includes('Wall conflict'),'the three marked half walls remain physical');
for(const [x,y] of [[20,64],[100,70],[129.5,90],[46,95]])assert.equal(messages(x,y).length,0,'area divisions must not create phantom wall conflicts');
assert.ok(itemPoints(plan.items.find(i=>i.name==='Cardio')).some(p=>p[0]===130.3&&p[1]===155));

// All four corners can be inside a concave room while an edge crosses a notch.
const concave={width:20,length:20,shape:'polygon',vertices:[[0,0],[20,0],[20,20],[12,20],[12,8],[8,8],[8,20],[0,20]]};
assert.ok(inspect([{...machine,x:6,y:6,width:8,length:9}],concave).get('machine').includes('Outside room'));
assert.equal(inspect([{...machine,x:6,y:6,width:8,length:2}],concave).get('machine').length,0,'touching a boundary is allowed');
for(const vertices of [[[0,0],[10,10],[0,10],[10,0]],[[0,0],[181,0],[0,155]],[[0,0],[NaN,0],[0,155]],[[0,0],[2,0]]]){
  assert.throws(()=>validateProject({...project,layouts:[{...plan,room:{...plan.room,vertices}}]}));
}
const resized=resizeRoom(plan.room,'width',360);
assert.equal(resized.vertices[3][0],360);
assert.equal(resized.walls[0].x1,310);
assert.equal(resized.walls[0].projections[0].x2,317,'wall projections scale with the traced plan');
assert.equal(resized.mainWidth,310);
assert.equal(roomArea(resized),roomArea(plan.room)*2);
assert.equal(plan.room.width,180,'resizing must not mutate the source');

const old={version:2,active:'saved',library:[{id:'custom-template'}],layouts:[{id:'saved',name:'My arrangement',room:{width:100,length:90},items:[{...machine,storedIn:'@storage',storageX:8,storageY:4}]}]};
const oldLayout=JSON.stringify(old.layouts[0]),oldLibrary=JSON.stringify(old.library);
assert.equal(installBuildingPlan(old),true);
assert.equal(old.active,BUILDING_PLAN_ID);
assert.equal(JSON.stringify(old.layouts[0]),oldLayout,'saved geometry, equipment and storage must be preserved');
assert.equal(JSON.stringify(old.library),oldLibrary);
assert.equal(installBuildingPlan(old),false,'install only once');
old.layouts=old.layouts.filter(l=>l.id!==BUILDING_PLAN_ID);
old.active='saved';
assert.equal(installBuildingPlan(old),false,'a deleted preset stays deleted');
const imported={version:2,active:'saved',layouts:[JSON.parse(oldLayout)]};
assert.equal(installBuildingPlan(imported,{activate:false}),true);
assert.equal(imported.active,'saved','an import keeps its selected arrangement');
const full={active:'saved',layouts:Array.from({length:100},(_,n)=>({id:String(n)}))};
assert.equal(installBuildingPlan(full),true);
assert.equal(full.layouts.length,101);

// Exercise the correction against a snapshot of a saved layout from version 8.
const legacy=JSON.parse(readFileSync(new URL('./fixtures/hart-building-plan-v1.json',import.meta.url)));
legacy.name='My saved arrangement';
legacy.items.push({...machine},{...machine,id:'stored',storedIn:'@storage',storageX:8,storageY:4});
const oldCardio=legacy.items.find(i=>i.name==='Cardio');
oldCardio.label={x:.25,y:.8,rotation:17};oldCardio.locked=true;
const expectedLabel=[oldCardio.x+oldCardio.width*oldCardio.label.x,oldCardio.y+oldCardio.length*oldCardio.label.y];
const editedCopy=structuredClone(legacy);editedCopy.id='custom-arrangement';
editedCopy.items.find(i=>i.name==='Cable').vertices=[[0,0],[1,0],[1,1],[0,1]];
const customContour=JSON.stringify(editedCopy.items.find(i=>i.name==='Cable'));
const unrelated=JSON.parse(oldLayout),untouched=JSON.stringify(unrelated);
const saved={version:2,active:legacy.id,buildingPlanInstalled:true,library:[],layouts:[legacy,editedCopy,unrelated]};
const equipment=JSON.stringify(legacy.items.filter(i=>i.category!=='area'));
assert.equal(upgradeBuildingPlan(saved),true);
assert.equal(saved.layouts.length,3);assert.equal(saved.active,legacy.id);
assert.equal(legacy.name,'My saved arrangement');
assert.equal(legacy.room.planRevision,BUILDING_PLAN_REVISION);
assert.equal(legacy.room.walls.filter(w=>w.type==='half').length,3);
assert.equal(roomArea(legacy.room),25400);
assert.equal(JSON.stringify(legacy.items.filter(i=>i.category!=='area')),equipment,'equipment, stored poses and IDs must not change');
assert.equal(JSON.stringify(editedCopy.items.find(i=>i.name==='Cable')),customContour,'custom contours must survive');
assert.equal(JSON.stringify(unrelated),untouched,'other saved layouts must be unchanged');
const updatedCardio=legacy.items.find(i=>i.name==='Cardio');
assert.equal(updatedCardio.locked,true);assert.equal(updatedCardio.label.rotation,17);
assert.deepEqual([updatedCardio.x+updatedCardio.width*updatedCardio.label.x,updatedCardio.y+updatedCardio.length*updatedCardio.label.y],expectedLabel);
assert.deepEqual(itemPoints(updatedCardio),itemPoints(plan.items.find(i=>i.name==='Cardio')));
assert.equal(upgradeBuildingPlan(saved),false,'the correction applies only once');
assert.equal(installBuildingPlan(saved),false,'the correction must not duplicate a saved arrangement');
assert.deepEqual(validateProject(JSON.parse(JSON.stringify(saved))),saved,'corrected saved work still imports and reloads');
const scaled=JSON.parse(readFileSync(new URL('./fixtures/hart-building-plan-v1.json',import.meta.url)));
scaled.room=resizeRoom(resizeRoom(scaled.room,'width',200),'length',160);
assert.equal(upgradeBuildingPlan({layouts:[scaled]}),true);
assert.equal(scaled.room.width,200);assert.equal(scaled.room.length,160);
assert.equal(scaled.room.vertices[6][0],155*200/180);assert.equal(scaled.room.vertices[6][1],160);

// Existing square-corner layouts retain their work while receiving the entry
// correction and wall projections from the drawing.
const versionTwo=JSON.parse(readFileSync(new URL('./fixtures/hart-building-plan-v2.json',import.meta.url)));
versionTwo.name='My current gym arrangement';
versionTwo.room.walls.find(w=>w.type==='half').thickness=.6;
versionTwo.items.find(i=>i.name==='Cable').vertices=[[0,0],[1,0],[1,1],[0,1]];
versionTwo.items.push({...machine},{...machine,id:'v2-stored',storedIn:'@storage',storageX:9,storageY:6});
const beforeEntryCorrection=structuredClone(versionTwo);
const v2Project={version:2,active:versionTwo.id,buildingPlanInstalled:true,layouts:[versionTwo]};
assert.equal(upgradeBuildingPlan(v2Project),true);
assert.equal(versionTwo.room.planRevision,BUILDING_PLAN_REVISION);
assert.deepEqual(versionTwo.items,beforeEntryCorrection.items,'all saved area edits, equipment and storage stay unchanged');
assert.deepEqual(versionTwo.room.vertices,beforeEntryCorrection.room.vertices,'the exterior remains unchanged');
assert.deepEqual(versionTwo.room.walls.filter(w=>w.type==='half').map(({projections,...w})=>w),beforeEntryCorrection.room.walls.filter(w=>w.type==='half'),'saved half-wall measurements stay unchanged');
assert.deepEqual(versionTwo.room.walls.filter(w=>w.name.startsWith('CrossFit shared wall,')).map(w=>[w.x1,w.y1,w.x2,w.y2]),[[155,4,155,37],[155,47,155,59]]);
assert.equal(versionTwo.room.walls.find(w=>w.name==='West wall projections').projections.length,11);
assert.equal(v2Project.active,versionTwo.id);assert.equal(v2Project.layouts.length,1);
assert.equal(versionTwo.name,beforeEntryCorrection.name);
assert.equal(upgradeBuildingPlan(v2Project),false,'the doorway correction is applied once');
assert.deepEqual(validateProject(JSON.parse(JSON.stringify(v2Project))),v2Project);
console.log('CrossFit main entry, blocked man door, square exterior, half walls and saved-layout correction checks passed.');
