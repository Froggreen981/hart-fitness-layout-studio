import {itemPoints,roomPoints,size,wallPolygons,validateRoomGeometry,simplePolygon} from '../dist/model.mjs';

const WORKOUT_API_VERSION = 1;
// Bump the representation revision if an existing publication renders differently.
const WORKOUT_ETAG_REVISION = 2;

function workoutResponse(request, status, body, headers = {}) {
  return new Response(request.method === 'HEAD' || status === 304 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Vary': 'Authorization',
      'X-Content-Type-Options': 'nosniff',
      ...(status !== 304 ? {'Content-Type': 'application/json; charset=utf-8'} : {}),
      ...headers
    }
  });
}

function workoutError(request, status, code, message, headers) {
  return workoutResponse(request, status, {apiVersion: WORKOUT_API_VERSION, error: {code, message}}, headers);
}

async function validWorkoutToken(request, expectedHash) {
  const token = /^Bearer +([A-Za-z0-9_-]{43})$/i.exec(request.headers.get('Authorization'))?.[1];
  if (!token) return false;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  let difference = 0;
  for (let i = 0; i < hash.length; i++) {
    difference |= hash[i] ^ Number.parseInt(expectedHash.slice(2*i, 2*i+2), 16);
  }
  return difference === 0;
}

function workoutEtagMatches(header, tag) {
  // A quoted entity tag can contain commas. Compare complete quoted tokens.
  return header?.trim() === '*' ||
    Array.from((header || '').matchAll(/(?:^|,)\s*(?:W\/)?("[^"]*")\s*(?=,|$)/g),
      match => match[1]).includes(tag);
}

function workoutName(name) {
  if (typeof name !== 'string') throw new Error('Invalid published name');
  return name;
}

function validateWorkoutPublication(row, layout) {
  // Validate the stored snapshot without consulting today's catalog or rewriting it.
  // An older publication may omit every catalog field or reference a retired model.
  if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_.-]{1,120}$/.test(row.id) || typeof row.published_at !== 'string' ||
      !Number.isFinite(Date.parse(row.published_at)) || !layout || typeof layout.name !== 'string' ||
      !layout.room || ![layout.room.width,layout.room.length].every(value => Number.isFinite(value) && value >= 5 && value <= 500) ||
      !Array.isArray(layout.items) || layout.items.length > 1000) throw Error('Invalid publication');
  validateRoomGeometry(layout.room);
  const ids = new Set();
  for (const item of layout.items) {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.name !== 'string' ||
        !['cardio','strength','free','obstacle','area'].includes(item.category) ||
        !['treadmill','elliptical','bike','rack','bench','cable','column','custom','area'].includes(item.kind) ||
        ![item.x,item.y,item.width,item.length,item.rotation].every(Number.isFinite) ||
        item.width <= 0 || item.length <= 0 || item.width > 100 || item.length > 100 ||
        Math.abs(item.x) > 1000 || Math.abs(item.y) > 1000 || item.rotation < 0 || item.rotation >= 360 ||
        item.status !== undefined && !['available','out-of-service'].includes(item.status)) throw Error('Invalid published item');
    ids.add(item.id);
    if (item.category === 'area') {
      if (typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color) ||
          !['allowed','keep-clear'].includes(item.placement) ||
          item.label !== undefined && (!item.label || ![item.label.x,item.label.y,item.label.rotation].every(Number.isFinite) ||
            item.label.x < 0 || item.label.x > 1 || item.label.y < 0 || item.label.y > 1 || Math.abs(item.label.rotation) > 360))
        throw Error('Invalid published area');
      if (item.vertices !== undefined && (!simplePolygon(item.vertices) ||
          !item.vertices.every(point => point.every(value => value >= 0 && value <= 1))))
        throw Error('Invalid area footprint');
    }
    for (const key of ['catalogId','inventoryId','manufacturer','modelNumber','modelStatus'])
      if (item[key] !== undefined && typeof item[key] !== 'string') throw Error('Invalid published metadata');
    if (item.modelStatus !== undefined && !['verified','probable','reported','corrected','unidentified'].includes(item.modelStatus))
      throw Error('Invalid published model status');
    for (const key of ['muscleGroups','exercises','capabilities'])
      if (item[key] !== undefined && (!Array.isArray(item[key]) || !item[key].every(value => typeof value === 'string')))
        throw Error('Invalid published exercise metadata');
  }
}

function workoutEquipment(item) {
  const {id,category,kind,x,y,width,length,rotation,status} = item;
  return {
    id, name: workoutName(item.name), category, kind, x, y, width, length, rotation,
    status: status === 'out-of-service' ? 'out-of-service' : 'available',
    footprint: itemPoints(item),
    ...Object.fromEntries(['catalogId','inventoryId','manufacturer','modelNumber','modelStatus']
      .filter(key => typeof item[key] === 'string' && item[key].length > 0).map(key => [key,item[key]])),
    ...Object.fromEntries(['muscleGroups','exercises','capabilities']
      .filter(key => Array.isArray(item[key])).map(key => [key,[...item[key]]]))
  };
}

function workoutArea(item) {
  const label = item.label ?? {x: .5, y: .5, rotation: 0};
  const [width, height] = size(item);
  const angle = item.rotation * Math.PI / 180;
  const dx = (label.x - .5) * item.width;
  const dy = (label.y - .5) * item.length;
  return {
    id: item.id, name: workoutName(item.name), footprint: itemPoints(item),
    color: item.color, placement: item.placement,
    label: {
      x: item.x + width/2 + dx*Math.cos(angle) - dy*Math.sin(angle),
      y: item.y + height/2 + dx*Math.sin(angle) + dy*Math.cos(angle),
      rotation: (item.rotation + label.rotation + 360) % 360
    }
  };
}

function workoutLayout(layout, items, equipment) {
  const room = layout.room;
  return {
    name: workoutName(layout.name),
    room: {
      width: room.width, length: room.length, boundary: roomPoints(room),
      walls: (room.walls || []).map(wall => ({
        name: wall.name, type: wall.type, footprints: wallPolygons(wall)
      })),
      zones: (room.zones || []).map(({name,x,y,angle = 0}) => ({name,x,y,angle}))
    },
    areas: items.filter(item => item.category === 'area').map(workoutArea),
    obstacles: items.filter(item => item.category === 'obstacle').map(item => ({
      id: item.id, name: workoutName(item.name), footprint: itemPoints(item)
    })),
    equipment
  };
}

export async function workoutApi(request, env, resource) {
  try {
    const origin = request.headers.get('Origin');
    const fetchSite = request.headers.get('Sec-Fetch-Site');
    if ((origin && origin !== new URL(request.url).origin) || ['cross-site','same-site'].includes(fetchSite)) {
      return workoutError(request, 403, 'origin_denied', 'Cross-origin access is unavailable. Use the workout app backend.');
    }
    const expectedHash = env.WORKOUT_API_TOKEN_SHA256;
    if (!/^[0-9a-f]{64}$/i.test(expectedHash ?? '')) {
      return workoutError(request, 503, 'integration_unavailable', 'Workout integration is unavailable.');
    }
    if (!await validWorkoutToken(request, expectedHash)) {
      return workoutError(request, 401, 'unauthorized', 'A valid workout integration token is required.', {
        'WWW-Authenticate': 'Bearer realm="gym-workout-api"'
      });
    }
    if (resource !== 'layout' && resource !== 'equipment') {
      return workoutError(request, 404, 'endpoint_not_found', 'Workout API endpoint not found.');
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return workoutError(request, 405, 'method_not_allowed', 'Use GET or HEAD.', {'Allow': 'GET, HEAD'});
    }
    if (!env.DB) {
      return workoutError(request, 503, 'integration_unavailable', 'Workout integration is unavailable.');
    }

    const row = await env.DB.prepare(
      'SELECT id, published_at, public_json FROM gym_publications ORDER BY sequence DESC LIMIT 1'
    ).first();
    if (!row) {
      return workoutError(request, 404, 'no_publication', 'Staff have not published a current gym layout.');
    }

    // HEAD and 304 must not claim an unreadable snapshot is usable. Authenticate,
    // read and validate the same row before deciding whether a body is needed.
    const layout = JSON.parse(row.public_json);
    validateWorkoutPublication(row, layout);
    const tag = `"gym-v${WORKOUT_API_VERSION}-r${WORKOUT_ETAG_REVISION}-${resource}-${row.id}"`;
    const headers = {'ETag': 'W/' + tag, 'Cache-Control': 'private, no-cache'};
    if (workoutEtagMatches(request.headers.get('If-None-Match'), tag)) {
      return workoutResponse(request, 304, null, headers);
    }
    if (request.method === 'HEAD') return workoutResponse(request, 200, null, headers);

    const items = layout.items.filter(item => !item.storedIn && !(item.category === 'area' && item.storage));
    const equipment = items.filter(item => ['cardio','strength','free'].includes(item.category)).map(workoutEquipment);
    const payload = {
      apiVersion: WORKOUT_API_VERSION,
      publication: {id: row.id, publishedAt: row.published_at},
      ...(resource === 'layout' ? {layout: workoutLayout(layout, items, equipment)} : {equipment})
    };
    return workoutResponse(request, 200, payload, headers);
  } catch {
    console.error('Workout API could not read the published layout.');
    return workoutError(request, 500, 'publication_unavailable', 'The published layout could not be read.');
  }
}
