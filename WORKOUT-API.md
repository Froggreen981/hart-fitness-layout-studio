# Hart Fitness Center workout API

This API gives the workout app the same published arrangement shown on the current gym map. The workout app owns workout generation and exercise mappings. The routes are read-only and use the existing publication database. Fixture examples below are invented for integration testing.

## Requests

| Method and path | Response |
| --- | --- |
| GET /api/v1/layout | Publication metadata, room boundary, walls, zones, areas, obstacles and floor equipment. Use this single request to draw the map and highlight equipment from a consistent snapshot. |
| GET /api/v1/equipment | Publication metadata and floor equipment only. Use it for equipment pickers and mapping validation. |
| HEAD on either route | Status and headers without a body. |

Call the API from the workout app's backend over HTTPS. Send `Authorization: Bearer <workout-token>`. Keep credentials on the backend and apply the approved workout-app audience before relaying map data to users. Cross-origin browser requests and preflights are rejected. A gym staff login and the workout token grant separate permissions.

The API is disabled until the operator configures `WORKOUT_API_TOKEN_SHA256` with the 64-digit SHA-256 hex digest of the token. Generate the token from 32 cryptographically random bytes encoded as unpadded base64url (43 characters). Store the token in the workout backend's secret manager and the digest in the gym Worker's runtime secret settings. The digest is computed over the encoded token string. Replace the digest to rotate the credential, then update the caller. Remove the digest to disable the integration.

The current Sites visitor policy still gates the hostname. If Sites supplies supported non-user service access for this custom-audience Site, the workout backend must also send the platform credential in `OAI-Sites-Authorization: Bearer <site-service-token>` to this Site alone. Dispatch consumes that header before the Worker checks `Authorization`. Confirm this path in staging before handing off an endpoint URL. If the gateway cannot support the integration, coordinate a separately protected service route with the host operator. Preserve the current visitor audience and Sites identity header trust boundary. The API code alone grants no access through the gateway.

## Publication and caching

Both endpoints return `apiVersion: 1` and a `publication` object with the opaque `id` and ISO 8601 `publishedAt` timestamp. A new publish or history restore creates a new ID, even if the arrangement matches an older snapshot. Draft edits leave the current ID and data unchanged. Compare IDs for equality and use the timestamp for display.

Store the last successful body and `ETag` per endpoint, per authorized client context. Revalidate using `If-None-Match` on later calls. A `304` has no body and means reuse the cached body. A `200` replaces it. The layout and catalog have different ETags. If you use both and their publication IDs differ, refresh or use the equipment included in the layout response. Responses use `Cache-Control: private, no-cache`, so a private cache may store them and must revalidate before reuse. Revalidation still requires authorization.

| HTTP status | JSON error code | Meaning |
| --- | --- | --- |
| 401 | `unauthorized` | Supply the configured integration credential. |
| 403 | `origin_denied` | Make the request from the workout backend. |
| 404 | `no_publication` | Staff have yet to publish the current layout. Show a map-unavailable state and check again later. |
| 404 | `endpoint_not_found` | Check the version and route. |
| 405 | `method_not_allowed` | Use GET or HEAD. |
| 500 | `publication_unavailable` | Retry with backoff. |
| 503 | `integration_unavailable` | Check integration enablement or shared storage with the gym operator. |

API errors use `{"apiVersion":1,"error":{"code":"no_publication","message":"Staff have not published a current gym layout."}}` and are served with `Cache-Control: no-store`. The Sites gateway may return its own response before reaching the API. Treat redirects and non-JSON errors as upstream failures. Keep credentials scoped to the intended hostname.

## Coordinates and IDs

- Coordinates and dimensions are in feet. The map frame starts at the upper-left of the room's bounding rectangle. Positive X runs right and positive Y runs down, matching SVG. The frame has no compass or geospatial reference. For SVG, use `viewBox="0 0 <room.width> <room.length>"` or add padding. A fixture or traced room may contain points outside a rectangular walking area.
- Draw polygons from `[x,y]` pairs in world coordinates. Close each polygon. Render the room boundary, areas, wall polygons and obstacles behind the machines. A wall's `footprints` array contains its main segment followed by any projections. `type` is `full` or `half`. Room `zones` are legacy labels with a clockwise angle in degrees. Area labels have an absolute X/Y and clockwise rotation.
- Equipment `x` and `y` are the top-left of its **axis-aligned bounding box after rotation**. `width` and `length` are the **unrotated** footprint dimensions along the equipment's local X and Y axes. `rotation` is in degrees, clockwise in this Y-down frame, in `[0, 360)`. The front edge is local negative Y. Use the supplied `footprint` as-is for placement and highlights. It is already rotated and positioned.
- For a renderer that positions sprites by center, set `a = rotation * Math.PI / 180`, `boxWidth = abs(cos(a)) * width + abs(sin(a)) * length`, and `boxHeight = abs(sin(a)) * width + abs(cos(a)) * length`. The center is `[x + boxWidth/2, y + boxHeight/2]`. Rotate the sprite around that point.
- Equipment `id` identifies a layout instance. Compare it exactly as an opaque, case-sensitive string. Copies of a draft, exports and imports retain instance IDs; new or duplicated equipment gets a new instance ID. Optional `inventoryId` identifies the surveyed physical unit (for example `HART-0014`), and `catalogId` identifies its model group (`CHK-014`). A duplicated equipment footprint clears `inventoryId` until staff assign an unused physical unit. Do not join independent layouts by name or assume instance IDs and survey IDs are interchangeable.
- Optional `manufacturer`, `modelNumber`, `modelStatus`, `muscleGroups`, `exercises` and `capabilities` describe the published equipment. These explicitly shared fields are frozen in the publication; draft edits and later changes to the reference catalog do not change them. Probable/reported models and staff-entered exercise fields require review and are not certified compatibility. Old publications can omit all catalog fields; no identity is guessed from a name. Staff notes, recovery copies, storage and templates remain excluded.
- A present item with `status: "out-of-service"` has a location but is unavailable for a workout. Staff set this in **Equipment availability** and publish the change. A missing ID means it is absent from the current floor catalog. That may reflect removal, storage, or an ID that never existed in this publication. Do not infer a storage location or substitute by name. The catalog reflects the last publication, so availability is not a live occupancy or maintenance feed.

## Sample responses

The following layout is a complete fictional example for renderer development.

```json
{
  "apiVersion": 1,
  "publication": {"id": "sample-publication-2", "publishedAt": "2026-01-01T18:00:00.000Z"},
  "layout": {
    "name": "Sample room",
    "room": {
      "width": 40,
      "length": 30,
      "boundary": [[0,0],[40,0],[40,30],[0,30]],
      "walls": [],
      "zones": []
    },
    "areas": [],
    "obstacles": [],
    "equipment": [
      {
        "id": "sample-rack-a",
        "name": "Sample rack A",
        "category": "strength",
        "kind": "rack",
        "x": 12,
        "y": 20,
        "width": 4,
        "length": 7,
        "rotation": 90,
        "status": "available",
        "footprint": [[19,20],[19,24],[12,24],[12,20]]
      }
    ]
  }
}
```

The catalog uses the same equipment records at the top level. This example shows a separate fictional publication with an empty floor catalog.

```json
{
  "apiVersion": 1,
  "publication": {"id": "sample-empty-publication", "publishedAt": "2026-01-01T19:00:00.000Z"},
  "equipment": []
}
```

## Integration example

On the backend, revalidate the same snapshot in a single sequential poll. Give each poller a separate cache for its base URL and credential context.

```js
let cachedLayout;

async function readGymLayout({gymOrigin, workoutToken, siteServiceToken}) {
  const response = await fetch(new URL('/api/v1/layout', gymOrigin), {
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${workoutToken}`,
      ...(siteServiceToken && {'OAI-Sites-Authorization': `Bearer ${siteServiceToken}`}),
      ...(cachedLayout?.etag && {'If-None-Match': cachedLayout.etag})
    }
  });

  if (response.status === 304 && cachedLayout) return cachedLayout.body;
  if (!response.ok) {
    cachedLayout = undefined;
    const error = await response.json().catch(() => null);
    if (response.status === 404 && error?.error?.code === 'no_publication') return null;
    throw new Error(`Gym layout request failed (${response.status})`);
  }

  const body = await response.json();
  if (body.apiVersion !== 1 || !body.publication?.id || !Array.isArray(body.layout?.equipment)) {
    throw new Error('Unexpected gym layout response');
  }
  cachedLayout = {etag: response.headers.get('ETag'), body};
  return body;
}
```

Pass equipment IDs from the workout to the renderer. The following sample workout references one fixture ID and one missing ID. Deduplicate IDs for drawing while retaining the original exercise order in the workout.

```js
const sampleWorkoutEquipmentIds = ['sample-rack-a', 'sample-bike-b'];
const byId = new Map(snapshot.layout.equipment.map(item => [item.id, item]));

for (const id of new Set(sampleWorkoutEquipmentIds)) {
  const equipment = byId.get(id);
  if (equipment?.status === 'available') {
    highlightPolygon(equipment.footprint, {id});
  } else {
    showUnavailableEquipment(id, equipment?.status ?? 'missing');
  }
}
```

The exercise-to-equipment extension point is the equipment-ID join. A workout app can maintain its own reviewed mapping of exercise IDs to candidate Hart equipment IDs and resolve the actual machines against the current catalog. Keep that mapping versioned separately from publications. Record the publication ID used to build a workout and recheck each selected ID when the layout changes. Category and drawing kind describe the equipment and do not certify exercise compatibility.

## Verification and rollout

Run `npm test` and `npm run build` on Node 24. The loopback development server accepts `WORKOUT_API_TOKEN_SHA256` as an environment variable for local testing with SQLite. Use test credentials and a disposable database there. The SQLite integration tests create and publish labeled fixtures and exercise authorization, redaction, exact geometry, conditional reads and publication changes without hosted writes.

Before enabling this for another team, verify in a restricted staging deployment that the backend can pass the Site gate, only the workout routes accept the workout token, anonymous and cross-origin requests fail, and staff permissions remain independent. Confirm the first production arrangement in the gym and publish it under the existing staff workflow. Then verify the approved backend sees that publication's ID and exact equipment positions.
