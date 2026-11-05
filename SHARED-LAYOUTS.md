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

## Source reconciliation and hosting

The latest Sites source was recovered from the existing Site's source repository at commit `45b73a0902e3c7174f8eac16b3992964014d94e5` (saved version 10). Its `dist/building-plan.mjs`, fixtures, geometry, editing controls and building-plan regression tests are integrated into this branch. The preserved plan has a square lower-right exterior, the wider lower CrossFit opening, blocked man door, full-wall projections and three half walls with their returns. The spinning area remains excluded. No floor geometry was recreated from memory.

The shared editor keeps the latest planner controls. It does not auto-add reference arrangements to an opened shared draft. Existing browser layouts and storage are retained under `gym-layout-studio-v1`; importing creates separate shared drafts. The original Sites source commit and saved version remain recoverable. The former 100-layout validation and reference-install caps are removed; paginated listings and request byte limits bound individual operations without capping the number of experimental drafts.

The existing `.openai/hosting.json` now declares `d1: "DB"` and preserves the Site identity. The build emits `dist/server/index.js`, embeds static assets and excludes local test-identity code. The initial schema is generated from `db/schema.ts` into `drizzle/0000_shared_layouts.sql` with its journal and snapshot. Sites applies the migration before uploading the Worker. Local tests use that same SQL through `scripts/sqlite-db.mjs`. No schema is created by production request handlers.

`STAFF_OWNER_EMAIL` is configured through the Site runtime settings as a secret using the verified Site owner. Its value is never stored in source. The Site keeps its existing custom audience and domain. The API trusts only identity headers injected by Sites dispatch. Do not deploy this Worker to a standalone public endpoint that accepts arbitrary client identity headers. A move to a different host requires verified authentication at that host.

## Remaining release verification

- **Done:** version 11 deployed successfully on November 5, 2026. Live D1 exposes `gym_drafts`, `gym_imports`, `gym_publications`, and `gym_staff`. The deployed `/api/current` returns `{current:null}` until a physically verified arrangement is published. Anonymous `/api/session` and `/api/drafts` return 401. A service request carrying forged owner identity headers also returns 401, confirming dispatch strips caller-supplied identity. GitHub Shared layout verification passed for commit `5ac018fb6095d1b3d6c381421a38948a815539ce`.
- Sign in as the owner through ChatGPT and confirm the owner role in Shared layouts.
- Obtain the manager's exact email. The selected role is **editor**. Add their email under Shared layouts > Staff access, then grant that same person visitor access in the Site's access settings. These are separate checks. No invitation is sent by this application.
- Export any useful browser-only work from its original address before importing it. Alternatively, New Hart draft creates an unpublished copy of the latest building plan. A plan reference is not evidence of actual equipment locations.
- In two independently signed-in staff sessions, open the same draft, save from one and verify a stale save from the other is rejected with recoverable changes. Reload and reopen in a fresh session to verify persistence.
- As the manager/editor, verify publishing is forbidden. As owner, verify that publishing requires physical-state confirmation and both draft/current revision checks. Publish only an arrangement checked against the physical gym.
- Verify the read-only map has identical walls, projections, area labels and equipment; later draft edits must not change it.
- Verify anonymous access policy before opening the map to patrons. The current custom Site audience still requires authorized visitor sign-in.
- Merge PR #1 only after those live checks pass. Do not begin the muscle selector before this milestone.

Local preview reported `http://terminal.local:4173/` but the browser connection was refused. The live browser reached the Site's ChatGPT sign-in gate. Secure Google sign-in advanced to an OpenAI passkey verification screen; no signed-in owner or manager session has been verified. Browser and two-account verification remain blocking checks for merge.

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

The generated Worker is parsed as ESM and its fetch entry point is verified during the build. Additional integration checks verify the latest Hart plan through shared save/publish, safe projection filtering, unchanged publications after draft edits, deployed entrypoint routing, and anonymous staff rejection. All 27 test files/subtests pass, including the existing inline regression assertions.

Browser rendering and deployed D1 behavior require the live checks above. Source retrieval is now working.

## Next feature

After the shared deployment and latest map are verified, add the reviewed equipment/exercise/muscle catalog and the patron muscle selector.

