# Shared layouts implementation

## Implemented

- Shared draft listing with pagination, duplication, renaming, archiving and restore.
- Per-layout database saves with optimistic revision checks.
- Separate current-gym publications, immutable history, and restoration by appending a new publication.
- Atomic publish checks against both the draft revision and the current publication.
- A read-only current map using the same geometry functions as the planner.
- Import of browser version 1 and 2 exports as new drafts. Existing server layouts are preserved.
- Permanent equipment item IDs preserved in duplicates and imports.
- Per-editor recovery copies, explicit recovery as separate drafts, and safe retries after a lost response.
- Staff editor/publisher roles and an owner-managed email allowlist.
- Public map refresh on focus and every 60 seconds while the page is visible.
- A dependency-free Worker build with all static assets embedded.

## Run locally

Use Node.js 24 or later.

```powershell
node --test test-*.mjs
node scripts/build-worker.mjs
node scripts/dev-server.mjs
```

Open http://127.0.0.1:4173/ for Shared layouts.

The development server uses a persistent local SQLite database at .gym-dev.sqlite and a local test identity, owner@example.test. It binds only to loopback. Its test identity code is excluded from the Worker build. Do not expose the development server publicly.

The browser planner remains at index.html. Import browser layouts or a JSON export from the original planner to populate shared drafts. Do not publish a sample arrangement as the actual gym.

## Hosted setup still required

The existing Sites source service could not be reached from this restricted workspace. No hosted database or live site was changed.

Before hosting:

1. Recover and reconcile the latest Sites source with this feature branch. The GitHub baseline is older than the hosted Hart geometry.
2. Retain the existing Site ID, audience, domain, and relevant hosting configuration.
3. Bind a provisioned D1 database as DB.
4. Apply worker/schema.sql as a versioned schema migration through the hosting workflow. Do not create tables inside request handlers.
5. Set STAFF_OWNER_EMAIL to the verified owner email through the host's runtime environment settings.
6. Package build/server/index.mjs through the host's supported Worker workflow.
7. Verify that only Sites dispatch can reach the Worker and that its authenticated identity headers are trusted.
8. Import the latest real layout, check geometry and equipment against the gym, and publish the first actual-state arrangement.
9. Add each manager's application permission and site visitor access separately. No invitation emails are sent by this application.
10. Verify save/load and a stale-save conflict with two signed-in staff accounts before opening patron access.

The production API trusts the identity headers supplied by Sites dispatch: oai-authenticated-user-id and oai-authenticated-user-email. It must not be exposed as an unprotected standalone Worker accepting client-supplied identity headers. A later move to independently managed Cloudflare hosting needs authenticated request verification for that host.

## Geometry compatibility

The development branch starts from GitHub main at 3a6921e4306aa7aeefac5c656bc09e9f46faeecd. The newer hosted planner was inaccessible because the source host could not resolve and the available browser required sign-in.

Imports preserve room data, walls, equipment, IDs, planning buffers, storage assignments, contours, labels, and templates. The compatibility layer accepts traced/polygon outlines stored in boundary, points, outline, or vertices. Its polygon checks and public renderer retain those coordinates. This is not a claim that the latest hosted export has been verified.

The newer hosted Hart outline, corrected CrossFit opening, and wall projections must be verified using its actual source or a current export before release. No remembered or newly estimated floor plan has replaced it.

## API

| Route | Access and behavior |
| --- | --- |
| GET /api/current | Current public snapshot only; no staff notes, stored equipment, or draft metadata. |
| GET /api/session | Authorized staff identity and role. |
| GET /api/drafts | Staff-only bounded page of draft metadata. |
| POST /api/drafts | Create a draft, preserving physical equipment IDs. |
| GET /api/drafts/:id | Full staff draft and saved revision. |
| PUT /api/drafts/:id | Save only when expectedRevision matches. |
| POST /api/drafts/:id/archive | Reversible archive/restore with revision checks. |
| POST /api/drafts/:id/publish | Publisher access, physical-state confirmation, draft and current checks. |
| POST /api/drafts/from-current | Full private planning copy of the current publication. |
| POST /api/import | Non-destructive, idempotent import as new drafts. |
| GET /api/history | Staff-only publication history. |
| POST /api/history/:id/restore | Append a new current publication from history. |
| GET/POST/DELETE /api/staff | Owner-only staff permission management. |

## Verification

The existing geometry, editing, printing-region, storage and import regression checks are retained. New integration tests execute the API against real SQLite, including staff authorization, concurrent saves/publications, recovery, idempotency, history and imports beyond 100 layouts. Client tests exercise the actual editor save queue, separate recovery copies, offline recovery and lost-response retries.

The generated Worker is parsed as ESM and its fetch entry point is verified during the build.

Browser rendering and deployed D1 behavior remain unverified. This environment blocked the local preview connection as well as the Sites source connection.

## Next feature

After the shared deployment and latest map are verified, add the reviewed equipment/exercise/muscle catalog and the patron muscle selector.

