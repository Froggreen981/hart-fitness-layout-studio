import {createHash,randomBytes} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api} from './worker/service.mjs';
import {sqliteDB} from './scripts/sqlite-db.mjs';
import {buildingPlan} from './dist/building-plan.mjs';
import {itemPoints,roomPoints,wallPolygons} from './dist/model.mjs';
import {applyCatalogIdentity,getCatalogRecord} from './dist/equipment-catalog.mjs';

const layoutPath = '/api/v1/layout';
const equipmentPath = '/api/v1/equipment';
const owner = 'owner@example.test';

function setup(t) {
  const DB = sqliteDB();
  t.after(() => DB.close());
  const token = randomBytes(32).toString('base64url');
  const auth = {Authorization: 'Bearer ' + token};
  const staff = {'oai-authenticated-user-id': 'owner-test', 'oai-authenticated-user-email': owner};
  const env = {DB, STAFF_OWNER_EMAIL: owner, WORKOUT_API_TOKEN_SHA256: createHash('sha256').update(token).digest('hex')};
  const call = (path, {headers, method, body} = {}, bindings = env) => api(new Request('https://gym.example.test' + path, {
    method, headers: {...headers, ...(body !== undefined ? {'Content-Type': 'application/json'} : {})},
    ...(body !== undefined ? {body: JSON.stringify(body)} : {})
  }), bindings);
  const staffCall = async (path, method = 'GET', body) => {
    const response = await call(path, {headers: staff, method, body});
    assert.ok(response.ok, await response.clone().text());
    return response.json();
  };
  return {auth, staff, env, call, staffCall};
}

const machine = (id, overrides = {}) => ({
  id, name: 'Sample rack', kind: 'rack', category: 'strength',
  x: 12, y: 20, width: 4, length: 7, rotation: 90, locked: false, buffer: 1, ...overrides
});

async function publish(staffCall, draftId, revision, previousId, requestId) {
  return (await staffCall('/api/drafts/' + draftId + '/publish', 'POST', {
    expectedRevision: revision, expectedCurrentId: previousId, requestId, confirmActual: true
  })).current;
}

test('v1 requires a separate server credential before accessing storage', async t => {
  const {auth, staff, env, call} = setup(t);
  let reads = 0;
  const bindings = {...env, DB: {prepare() { reads++; throw new Error('unexpected query'); }}};
  for (const headers of [{}, staff, {Authorization: 'Bearer ' + 'A'.repeat(43)}, {Authorization: 'Basic ' + 'A'.repeat(43)}]) {
    const response = await call(layoutPath, {headers: {...headers, 'If-None-Match': '*'}}, bindings);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer realm="gym-workout-api"');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).error.code, 'unauthorized');
  }
  for (const WORKOUT_API_TOKEN_SHA256 of [undefined, 'invalid configuration']) {
    const response = await call(layoutPath, {headers: auth}, {...bindings, WORKOUT_API_TOKEN_SHA256});
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'integration_unavailable');
  }
  assert.equal((await call(layoutPath, {headers: auth}, {...env, DB: undefined})).status, 503);
  assert.equal(reads, 0);
  for (const path of ['/api/session','/api/drafts','/api/staff','/api/history']) {
    assert.equal((await call(path, {headers: auth})).status, 401);
  }
  assert.deepEqual(await (await call('/api/current')).json(), {current: null});
});

test('v1 rejects cross-origin and write requests and describes an empty publication state', async t => {
  const {auth, call} = setup(t);
  for (const headers of [{Origin: 'https://workout.example.test'}, {Origin: 'null'}, {'Sec-Fetch-Site': 'same-site'}]) {
    const response = await call(layoutPath, {headers: {...auth, ...headers}});
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal((await response.json()).error.code, 'origin_denied');
  }
  const preflight = await call(equipmentPath, {method: 'OPTIONS', headers: {
    Origin: 'https://workout.example.test', 'Access-Control-Request-Headers': 'authorization'
  }});
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), null);

  for (const method of ['POST','PUT','DELETE','OPTIONS']) {
    const response = await call(layoutPath, {method, headers: auth});
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal((await response.json()).error.code, 'method_not_allowed');
  }
  const unknown = await call('/api/v1/drafts', {headers: auth});
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, 'endpoint_not_found');
  for (const path of [layoutPath, equipmentPath]) {
    const response = await call(path, {headers: {...auth, 'If-None-Match': '*'}});
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('ETag'), null);
    assert.deepEqual(await response.json(), {
      apiVersion: 1, error: {code: 'no_publication', message: 'Staff have not published a current gym layout.'}
    });
  }
});

test('v1 publishes corrected geometry and floor equipment with explicit private-field filtering', async t => {
  const {auth, call, staffCall} = setup(t);
  const layout = buildingPlan();
  layout.room.staffNotes = 'PRIVATE floor note';
  layout.room.innerWidth = {details: 'PRIVATE invalid optional geometry'};
  layout.room.points = [{details: 'PRIVATE ignored outline alias'}];
  layout.items[0].label.internalNote = 'PRIVATE label note';
  layout.room.walls[0].projections[0].notes = 'PRIVATE wall note';
  layout.items.push(
    machine('fixture/rack ü', {publicName: 'Sample public rack', name: 'PRIVATE internal rack name', notes: 'PRIVATE machine note'}),
    machine('sample-bike', {status: 'out-of-service', publicName: {notes: 'PRIVATE invalid display name'}, x: 21, y: 31}),
    machine('sample-stored', {storedIn: 'legacy-storage', storageX: 4, storageY: 5}),
    {...layout.items[0], id: 'legacy-storage', name: 'PRIVATE legacy storage area', storage: true},
    {...machine('sample-column'), kind: 'column', category: 'obstacle', locked: true}
  );
  await staffCall('/api/drafts', 'POST', {layout, library: [machine('private-template')]});
  const publication = await publish(staffCall, layout.id, 1, null, 'sample-publication');

  const response = await call(layoutPath, {headers: auth});
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.deepEqual(snapshot.publication, {id: publication.id, publishedAt: publication.publishedAt});
  assert.equal(snapshot.apiVersion, 1);
  assert.deepEqual(snapshot.layout.room.boundary, roomPoints(layout.room));
  assert.deepEqual(snapshot.layout.room.walls.flatMap(wall => wall.footprints), layout.room.walls.flatMap(wallPolygons));
  assert.deepEqual(snapshot.layout.areas[0].footprint, itemPoints(layout.items[0]));
  assert.deepEqual(snapshot.layout.obstacles.map(item => item.id), ['sample-column']);
  assert.deepEqual(snapshot.layout.equipment, [
    {id: 'fixture/rack ü', name: 'Sample public rack', category: 'strength', kind: 'rack', x: 12, y: 20,
      width: 4, length: 7, rotation: 90, status: 'available', footprint: [[19,20],[19,24],[12,24],[12,20]]},
    {id: 'sample-bike', name: 'Sample rack', category: 'strength', kind: 'rack', x: 21, y: 31,
      width: 4, length: 7, rotation: 90, status: 'out-of-service', footprint: [[28,31],[28,35],[21,35],[21,31]]}
  ]);
  const catalog = await (await call(equipmentPath, {headers: auth})).json();
  assert.deepEqual(catalog, {apiVersion: 1, publication: snapshot.publication, equipment: snapshot.layout.equipment});
  const legacy = await (await call('/api/current')).json();
  assert.equal(legacy.current.id, publication.id);
  assert.deepEqual(roomPoints(legacy.current.layout.room), snapshot.layout.room.boundary);
  for (const result of [snapshot, catalog, legacy]) {
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|sample-stored|legacy-storage|storageX|private-template|owner@example|sourceDraftId|updated_by|buffers/);
  }
});

test('v1 revalidates each resource and follows publication changes with stable instance IDs', async t => {
  const {auth, call, staffCall} = setup(t);
  const layout = {
    id: 'sample-draft', name: 'Sample layout', room: {width: 40, length: 30, shape: 'rect'},
    items: [machine('sample-rack'), machine('same-model-other-unit', {x: 20})]
  };
  const imported = await staffCall('/api/import','POST',{
    requestId: 'sample-import', project: {version: 1, active: layout.id, layouts: [layout]}
  });
  const draftId = imported.imported[0].id;
  const first = await publish(staffCall, draftId, 1, null, 'sample-version-1');
  const layoutResponse = await call(layoutPath, {headers: auth});
  const equipmentResponse = await call(equipmentPath, {headers: auth});
  const layoutTag = layoutResponse.headers.get('ETag');
  const equipmentTag = equipmentResponse.headers.get('ETag');
  const before = await equipmentResponse.json();
  assert.notEqual(layoutTag, equipmentTag);
  assert.equal(equipmentResponse.headers.get('Cache-Control'), 'private, no-cache');
  assert.equal(equipmentResponse.headers.get('Vary'), 'Authorization');
  assert.deepEqual(before.equipment.map(item => item.id), ['sample-rack','same-model-other-unit']);

  const head = await call(equipmentPath, {method: 'HEAD', headers: auth});
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('ETag'), equipmentTag);
  assert.equal(await head.text(), '');
  for (const [tag, method] of [[equipmentTag, 'GET'], ['"other,tag", ' + equipmentTag.slice(2), 'GET'], ['*', 'HEAD']]) {
    const response = await call(equipmentPath, {method, headers: {...auth, 'If-None-Match': tag}});
    assert.equal(response.status, 304);
    assert.equal(response.headers.get('ETag'), equipmentTag);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-cache');
    assert.equal(await response.text(), '');
  }
  assert.equal((await call(equipmentPath, {headers: {...auth, 'If-None-Match': layoutTag}})).status, 200);

  const draft = await staffCall('/api/drafts/from-current','POST',{expectedCurrentId:first.id});
  draft.layout.items[0].x = 16;
  draft.layout.items[0].status = 'out-of-service';
  draft.layout.items[1].storedIn = '@storage';
  await staffCall('/api/drafts/' + draft.layout.id, 'PUT', {...draft, expectedRevision: 1});
  assert.deepEqual(await (await call(equipmentPath, {headers: auth})).json(), before);

  const second = await publish(staffCall, draft.layout.id, 2, first.id, 'sample-version-2');
  const update = await call(equipmentPath, {headers: {...auth, 'If-None-Match': equipmentTag}});
  assert.equal(update.status, 200);
  assert.notEqual(update.headers.get('ETag'), equipmentTag);
  const after = await update.json();
  assert.equal(after.publication.id, second.id);
  assert.deepEqual(after.equipment.map(({id,x,status}) => ({id,x,status})), [
    {id:'sample-rack', x:16, status:'out-of-service'}
  ]);

  const restored = await staffCall('/api/history/' + first.id + '/restore', 'POST', {
    expectedCurrentId: second.id, requestId: 'sample-version-3', confirmActual: true
  });
  const restoredCatalog = await (await call(equipmentPath, {headers: auth})).json();
  assert.equal(restoredCatalog.publication.id, restored.current.id);
  assert.notEqual(restoredCatalog.publication.id, first.id);
  assert.deepEqual(restoredCatalog.equipment, before.equipment);
});

test('v1 storage errors return a redacted JSON response', async t => {
  const {auth, call, env} = setup(t);
  const response = await call(layoutPath, {headers: auth}, {
    ...env, DB: {prepare() { throw new Error('private database details'); }}
  });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), {
    apiVersion: 1, error: {code: 'publication_unavailable', message: 'The published layout could not be read.'}
  });
});

test('published inventory and exercise metadata stay tied to their snapshot and separate from instance IDs',async t=>{
  const {auth,call,staffCall}=setup(t);
  const unit=applyCatalogIdentity(machine('instance-curl'),getCatalogRecord('CHK-014'),'HART-0014');
  unit.notes='PRIVATE staff notes';
  const layout={id:'catalog-draft',name:'Catalog fixture',room:{width:50,length:50},items:[unit]};
  await staffCall('/api/drafts','POST',{layout,library:[]});
  await publish(staffCall,layout.id,1,null,'catalog-publication');
  const before=await (await call(equipmentPath,{headers:auth})).json();
  const published=before.equipment[0];
  assert.equal(published.id,'instance-curl');
  assert.equal(published.inventoryId,'HART-0014');
  assert.equal(published.catalogId,'CHK-014');
  assert.equal(published.modelStatus,'verified');
  assert.deepEqual(published.exercises,['biceps curl']);
  assert.deepEqual(published.muscleGroups,['biceps']);
  assert.doesNotMatch(JSON.stringify(before),/PRIVATE|notes|locked|buffer/);
  const draft=await staffCall('/api/drafts/'+layout.id);
  draft.layout.items[0].exercises=['reviewed variation'];
  await staffCall('/api/drafts/'+layout.id,'PUT',{...draft,expectedRevision:1});
  assert.deepEqual(await (await call(equipmentPath,{headers:auth})).json(),before);
  await publish(staffCall,layout.id,2,'catalog-publication','catalog-publication-next');
  const after=await (await call(equipmentPath,{headers:auth})).json();
  assert.deepEqual(after.equipment[0].exercises,['reviewed variation']);
  assert.equal(after.equipment[0].inventoryId,published.inventoryId);
  assert.equal(after.equipment[0].id,published.id);
});
