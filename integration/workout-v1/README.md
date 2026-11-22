# Workout team integration handoff — contract revision 1.0.0

This package exposes Gym Layout Studio's **official published arrangement**. The workout team owns exercises, muscle selection, exercise compatibility and routine generation. Nothing here publishes a layout or enables production access. All checked-in responses and mappings are **fictional**, not a Hart equipment arrangement or a compatibility claim.

See [ACCEPTANCE.md](ACCEPTANCE.md) for the external team’s exact offline cases and the review record that remains pending.

## Files and quick start

| File | Purpose |
| --- | --- |
| `response.schema.json` | JSON Schema 2020-12 for API v1 layout, equipment and errors; `$defs` permits validating one response type. |
| `fixtures/index.json` | HTTP status/resource/schema definition for seven synthetic success/error responses, including a refreshed publication. |
| `client.mjs` | Backend HTTPS client, private ETag cache, bounded response/timeout and equipment reference resolution. |
| `snapshot.mjs` | Shared identity validation for client, mappings and highlighting; rejects ambiguous IDs. |
| `exercise-mappings.schema.json`, `mappings.mjs` | Separately versioned mapping exchange and review/publication/ID validation. |
| `fixtures/fictional-mappings.json` | Explicitly fictional mapping, rejected for normal use until joint review. |

From the repository, use Node 24, `npm ci`, then `npm run test:consumer`. No network request, production credential or D1 database is needed by that harness. It validates fixtures and actual API projection shapes, authorization-context isolation, 304 caching, missing/empty states, timeouts, malformed responses, ID ambiguity, stale workouts and reviewed mapping rules. To copy the example independently, retain this directory and install `ajv@8` and `ajv-formats@3` in the backend project. JSON module import syntax targets Node 24.

```js
import {createGymClient, resolveWorkoutEquipment} from './client.mjs';

// Create one long-lived client for one approved origin and credential context.
const gym = createGymClient({
  gymOrigin: process.env.GYM_ORIGIN,
  workoutToken: process.env.GYM_WORKOUT_TOKEN,
  siteServiceToken: process.env.GYM_SITE_SERVICE_TOKEN // only if the approved gateway requires it
});
const snapshot = await gym.getLayout();
if (snapshot === null) {
  // Staff have not published; show an unavailable map, not a sample arrangement.
} else {
  // Replace the whole rendered snapshot together. Never combine resources from different publications.
  const resolution = resolveWorkoutEquipment(snapshot, {
    publicationId: savedWorkout.publicationId,
    equipmentIds: savedWorkout.equipmentIds
  });
  // If publicationChanged, recheck every reference and ask the workout app to review stale choices.
  // Highlight only resolution.equipment entries whose status is 'available'.
}
```

Supply only an approved HTTPS origin, without URL credentials, query strings or a path. Keep both tokens exclusively in the backend secret manager. Do not forward them to a browser or another host. The client refuses redirects, requires JSON, validates the response contract, coalesces concurrent reads and returns independent copies so renderer edits cannot poison its cache. A new origin/credential context requires a new client. Apply the approved workout audience before relaying data to patrons; do not expose a public proxy around the restricted gym API. Do not log request headers, secrets, response bodies or gateway redirects.

## Endpoint and caching behavior

`GET /api/v1/layout` contains every layer and its equipment from one immutable publication. Prefer it for drawing and selection. `GET /api/v1/equipment` contains the same equipment shape without room layers. `HEAD` has the corresponding status/headers and no body. Authenticate before revalidation; cross-origin browser access/preflights are denied.

`apiVersion: 1` is the HTTP representation version; package/schema revision **1.0.0** identifies this handoff. Publication IDs and ETags are opaque. Store them unchanged and compare IDs for equality. A new publish or history restore gets a new ID; a draft edit changes neither the publication nor its equipment. The schema permits unknown additive fields for v1 evolution; ignore them. A breaking shape change requires a new API version. Consumers must also enforce equipment `id` uniqueness; the example additionally rejects duplicate assigned `inventoryId` values.

A private cache may store `200` responses but must revalidate (`private, no-cache`). Send the endpoint's ETag in `If-None-Match`; `304` means reuse its existing body only after sending that cached body’s valid validator. Unsolicited or contradictory `304` responses fail closed, and `no-store` responses are not retained. Resource ETags differ. If independently fetching both resources yields different publication IDs, discard the mixed result and use a fresh layout response. The example makes a single layout request per refresh, keeps its ETag scoped to one client, and clears the cache on failures. It never silently serves stale locations after an auth, network, gateway or validation failure. It intentionally provides no background scheduler: refresh on map open/focus, before generating/resuming a workout, and at an agreed bounded interval while visible. Back off with jitter after failures rather than continuously retrying.

| Result | Consumer action |
| --- | --- |
| `200` with `equipment: []` | Valid published room with no floor equipment. Retain its publication ID. |
| `404 no_publication` | No official arrangement exists; hide location guidance and check again later. Client returns `null`. |
| `401 unauthorized` | Stop retrying aggressively; operator checks the independent workout credential. |
| `403 origin_denied` | Move the request to the approved backend. |
| `404 endpoint_not_found`, `405 method_not_allowed` | Correct version/path or use GET/HEAD. |
| `500 publication_unavailable` | Publication is unreadable or storage failed. Hide stale locations and retry with backoff; notify operator. |
| `503 integration_unavailable` | Integration disabled or storage unavailable. Coordinate with operator. |
| Redirect, HTML, invalid JSON/schema, timeout, unexpected `304` | Gateway/upstream failure; clear active guidance and retain the user's workout references for later review. |

`GymApiError` contains a safe `code` and `status`, without tokens or upstream body details. The Sites gateway may block requests before the Worker. Local tests do not establish gateway access. Production HEAD/conditional requests validate the stored publication before reporting success and return `no-store` errors for corruption.

## Drawing and highlighting

All distances are **feet**, in a local SVG-style frame: X increases right, Y increases down. There is no compass/geospatial reference. Use `viewBox="0 0 <room.width> <room.length>"` with optional padding so wall thickness at the boundary is visible. Preserve aspect ratio; scale screen pixels uniformly. A screen coordinate is not a measurement.

1. Draw `room.boundary` as a closed polygon.
2. Draw areas with their `footprint`, `color` and `placement`; organizational areas are not walls. Draw obstacles and **every** polygon in each wall's `footprints`, including projections/returns. Keep full/half wall styling distinguishable.
3. Draw floor equipment using its supplied closed `footprint`, then labels. Room zones supply absolute X/Y and clockwise `angle`; area labels supply absolute X/Y and clockwise `rotation`. Keep interactive equipment above area overlays.
4. Draw a separate highlight overlay for the exact requested `id` values. Preserve the official geometry and use text/icon cues as well as color. Do not move, resize, rotate or write back machines to highlight them.

A minimal SVG polygon uses `points={footprint.map(([x,y]) => x+','+y).join(' ')}`. Use DOM `textContent` (or framework escaping) for names; never inject a returned name as HTML. Draw wall polygons individually, not a line connecting separate footprints.

`width` and `length` are unrotated local dimensions. `rotation` is clockwise degrees in `[0,360)`, and local negative Y is the front. `x,y` mark the **rotated bounding box** top-left. The supplied polygon already includes rotation: do not rotate it again. For a sprite renderer only, compute `a = rotation*Math.PI/180`, `boxWidth = abs(cos(a))*width + abs(sin(a))*length`, `boxHeight = abs(sin(a))*width + abs(cos(a))*length`, and center `[x+boxWidth/2,y+boxHeight/2]`, then rotate around that center. The fictional 90° rack fixture is a regression example. Hart geometry fixtures remain authoritative for the facility; these synthetic rectangles must never replace them.

## Identity, availability and stale workouts

| Identifier | Meaning and safe use |
| --- | --- |
| `id` | Exact, case-sensitive layout instance ID. Workout references and highlights join this to the current snapshot. Copies/imports retain IDs; newly added/duplicated footprints get new IDs. |
| `inventoryId` | Optional surveyed physical unit. Distinct from an instance; duplication clears physical assignment. Use only an explicit current-publication assignment to resolve a physical unit. |
| `catalogId` | Optional model-group reference, potentially shared by multiple units. Never identifies a specific placed machine. |

A name, category, drawing kind or shared model does not identify a physical unit or certify exercise compatibility. Old publications may omit every catalog field. Later catalog edits must not fill or alter an immutable older snapshot. Model confidence may be `verified`, `probable`, `reported`, `corrected` or `unidentified`; published staff-entered exercise/muscle/capability strings are suggestions requiring review, not an exercise ontology.

`available` means available in the last publication, not real-time occupancy. `out-of-service` has a location but must not be selected for use. An absent ID is **missing from this floor snapshot**: it could be stored, removed or never present. Storage and internal staff observations are private; do not infer a storage location or substitute equipment by name/model. Keep missing references in the workout UI as unresolved choices.

Persist `publicationId`, selected instance IDs and the separately reviewed mapping version with each workout. On publication change, redraw the complete new room, resolve all references again and flag the workout for review. Existing IDs can move or change availability; same ID does not imply same location. A changed ID must never be silently substituted. The helper reports `publicationChanged` and deduplicated available/out-of-service/missing references without mutating the snapshot or inventing replacements.

## Exercise mapping coordination

Maintain exercise-to-equipment compatibility in the workout application, versioned independently from gym publications. The exchange schema requires a mapping version, source publication ID, review status/reference and unique candidate instance IDs per exercise. The validator rejects unreviewed/fictional mappings, stale source publications, duplicate exercises and references absent from the current published floor snapshot. An out-of-service candidate may remain a valid historical mapping, but must fail availability selection at workout time.

The checked-in `fictional-exercise-placeholder` is not a real exercise. `allowFictional: true` exists only for fixture tests. Changing a string to `reviewed` cannot establish human review: the teams must agree on exercise IDs, evidence/review record, supported machine variants, alternatives and review ownership before using actual mappings. Avoid automatic mappings from names, model guesses or generic catalog muscles. If maintaining mappings by physical unit in the workout system, explicitly resolve `inventoryId` to current `id` before using this exchange; zero/multiple matches are unresolved.

## Remaining handoff gates

The package and local harness are ready independently of production. Before the external team uses the real endpoint, the gym operator must complete: supported D1 backup/ledger checks, authorized existing-Site code deployment, approved backend passage through the Site gate with its separate workout credential, and physical walkthrough followed by deliberate owner publication. Confirm the backend receives the exact published ID/equipment positions and that invalid credentials cannot reach staff APIs. Agree on audience, refresh/backoff interval, failure UI and reviewed mappings. No production credentials or access grants are included here. See `../../WORKOUT-API.md`, `../../RELEASE-PLAN.md` and `../../LIVE-VERIFICATION.md`.
