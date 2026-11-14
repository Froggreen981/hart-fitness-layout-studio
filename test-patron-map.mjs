import {test} from 'node:test';
import assert from 'node:assert/strict';

test('the read-only map draws machines above areas and clears a removed selection', async t => {
  const node = () => ({
    innerHTML: '', textContent: '', attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); }
  });
  const elements = Object.fromEntries([
    'mapName','publishedAt','publicMap','equipmentList','equipmentDetails','mapStatus','refreshMap'
  ].map(id => [id, node()]));
  const machine = {id:'sample-rack',name:'Sample rack',category:'strength',x:1,y:1,width:4,length:7,rotation:0};
  const area = {id:'sample-zone',name:'Sample zone',category:'area',x:0,y:0,width:15,length:15,rotation:0};
  const publication = (id, items) => ({
    id, publishedAt:'2026-01-01T00:00:00.000Z', layout:{name:'Sample map',room:{width:25,length:25},items}
  });
  let current = publication('sample-1', [machine, area]);
  const globals = {
    document: {getElementById:id=>elements[id],querySelectorAll:()=>[]},
    window: {addEventListener() {}},
    fetch: async () => Response.json({current}),
    setInterval() {}
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {configurable:true,writable:true,value});
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  await import('./dist/patron-map.mjs');
  const markup = elements.publicMap.innerHTML;
  assert.match(markup, /Sample zone[\s\S]*data-equipment="sample-rack"/);
  elements.equipmentList.onclick({target:{closest:()=>({dataset:{equipment:machine.id}})}});
  assert.equal(elements.equipmentDetails.textContent, 'Sample rack');

  current = publication('sample-2', [{...machine, status:'out-of-service'}, area]);
  await elements.refreshMap.onclick();
  assert.equal(elements.equipmentDetails.textContent, 'Sample rack · Out of service');

  current = publication('sample-3', [area]);
  await elements.refreshMap.onclick();
  assert.equal(elements.equipmentDetails.textContent, 'Select equipment on the map or in the list.');
  assert.doesNotMatch(elements.publicMap.innerHTML, /data-equipment="sample-rack"/);

  current = null;
  await elements.refreshMap.onclick();
  assert.equal(elements.mapName.textContent, '');
  assert.equal(elements.publishedAt.textContent, '');
  assert.match(elements.mapStatus.textContent, /have not published/);
});
