# Gym Layout Studio development status

Verified November 13, 2026 (America/Denver). This records reconciliation findings, not release approval.

## Authority and environment

- **Authoritative source:** [Froggreen981/hart-fitness-layout-studio](https://github.com/Froggreen981/hart-fitness-layout-studio). Continue on **`codex/shared-gym-layouts`**, verified at `c10f05c2633b46b57e6dc367a818a139567ca0aa`. [PR #1](https://github.com/Froggreen981/hart-fitness-layout-studio/pull/1) remains open, draft and unmerged. `main` is not the complete shared application.
- **Existing deployment target:** ChatGPT Sites, project `appgprj_6ae42d870d0481918f92cb6a7697a4d6`, retaining its Worker, D1 `DB`, custom audience and [staff workspace](https://gym.huffworkshop.com/workspace.html). Sites confirms the custom domain and TLS are active. GitHub Pages is a separate legacy browser-planner target and cannot run the shared API.
- Develop in GitHub; retain Sites source as deployment provenance. A later release must package the reviewed GitHub tree for the same Site and record both GitHub and Sites commit/version identifiers. GitHub pushes do not establish Sites synchronization.
- The checkout started clean on `work` at `73d3dbe`; that branch is preserved. The active shared branch tracks its origin branch. Origin fetch configuration now includes all three reviewed branches. Node **24.22.1**, npm **11.9.0**, lockfile dependencies, drizzle-kit **0.31.10** and drizzle-orm **0.45.2** are available. `.nvmrc` selects Node 24.

## Reconciliation baseline: committed versions and tests

All refs were freshly fetched. Tests used the commits below in separate checkouts.

| Branch | Committed implementation | Verification in this review | Deployment evidence |
| --- | --- | --- | --- |
| `main` — `73d3dbe` | Original browser planner plus phone model checklist for 95 groups / 155 entries, including seven Rogue benches. No shared Worker/D1 application or recovered building-plan module. | 5 test files pass; application syntax passes. Checklist interactions lack dedicated automated tests. | Pages workflow exists; current Pages deployment was not verified. |
| `codex/shared-gym-layouts` — `c10f05c` | Recovered Sites geometry/planner, staff roles, shared drafts/recovery, protected publications, read-only map, 95-group / 155-entry catalog, sourced dimensions/exercise metadata and unique inventory assignment. | 37 tests pass; Worker build/ESM and app/service syntax pass. GitHub verification run 43502073762 succeeded for this SHA. | Recorded version 13 predates the 15 catalog commits after `5f6db7a`; no verified hosted release of those additions. |
| `codex/workout-integration-api` — `27029a4` | Two commits after ancestor `5f6db7a`: authenticated read-only `/api/v1/layout` and `/api/v1/equipment`, recovery-import/corrupt-record fixes, map selection/layer fixes, publication retry and public-data filtering improvements. No November catalog. | 39 tests pass; Worker build/ESM and workout module syntax pass. GitHub verification run 42428478794 succeeded for this SHA. | No verified Sites release; gateway/service authentication and an actual published arrangement remain rollout prerequisites. |

`main` and shared have **3 / 21** exclusive commits; workout and shared have **2 / 15**. Neither includes all the others' work. No branches or older implementations were merged or removed.

## Preservation and production findings

- The shared source retains original controls, v1/v2 imports/exports, browser key `gym-layout-studio-v1`, equipment IDs, storage, templates, buffers, rotation, areas, printing and BYU-Idaho styling. Regression checks pass; editor/storage/sketch/style modules are unchanged from `main`.
- SHARED-LAYOUTS.md records recovery of Sites version 10 source `45b73a0902e3c7174f8eac16b3992964014d94e5`. Tests verify the square exterior corner, lower CrossFit entrance, blocked man door, projections and three half walls through shared save/publication. No geometry was recreated here; original archive bytes could not be rechecked.
- Staff authorization still requires Sites-injected identity, the owner runtime setting and application roles. Tests cover anonymous rejection, editor/publisher separation, revision conflicts, recovery, explicit physical-state confirmation, immutable publications and non-destructive imports. Local test identities are excluded from the Worker. Catalog linking preserves geometry; duplicate physical IDs are rejected, and duplicated equipment loses its physical inventory assignment.
- Sites reports **version 13**, source `c6920abd0815145bb956dacc364331cacb463695`, successfully deployed November 7. Historical PR/release notes associate it with GitHub `5f6db7a`; the SHAs belong to separate repositories. That recorded deployment predates November 13 catalog commits, so the recorded deployment is behind the development branch. This does **not** establish deployed-file equality with any GitHub commit.
- Read-only D1 inspection confirms `gym_drafts`, `gym_imports`, `gym_publications`, `gym_staff`, one application editor role and **zero publications**. Production data and draft contents were not changed. Previously documented owner-browser persistence/conflict checks are historical evidence, not checks repeated today.
- **Access discrepancy:** the release notes report a manager Site visitor grant, but the current Sites response lists only the owner, zero external visitors and no Site editors. The application editor role exists separately in D1. Manager Site access and independent sign-in remain unconfirmed; neither permission establishes the other.
- **Limits:** direct HTTPS to the custom domain failed with the environment proxy's HTTP 403 CONNECT denial. Saved version-10/version-13 archive downloads returned “file could not be authorized or resolved.” No signed-in staff browser check or deployed-file comparison was performed. Direct verification needs permitted hostname access and an authorized staff session, or authorized saved-source/artifact access. No bypass token was generated or used.

## Reconciliation steps

1. Preserve browser-layout exports and arrange a supported production backup before any future migration/release. Retain Site identity, D1, audience and source/version history.
2. Resolve the manager-access discrepancy through both Site visitor policy and application role. Repeat independent staff save, conflict, recovery and publish-denial checks on staff devices.
3. Review the three `main` checklist commits for a selective port. Reconcile checklist/catalog records, retaining unknown/probable status and browser progress. Do not replace the shared tree with `main`.
4. Review workout-branch recovery, map, retry and filtering fixes independently of API rollout. Reconcile layout-instance `item.id` with surveyed physical `inventoryId` before promising cross-app physical-ID joins. Keep the API disabled until its gateway and separate credential path pass verification; review before merging.
5. Verify hosted catalog addition/linking, duplicate/template IDs, dimension provenance and cross-session persistence. Dimensions can be copied from a draft item or suggested from manufacturer inches converted to feet; confirm actual footprints and positions in the gym. Catalog data is not a published arrangement.
6. Before a later authorized release, compare the reviewed GitHub tree with Sites source/artifacts, record both identifiers, and run tests/build plus hosted staff QA. No automatic GitHub-to-Sites sync is established. Do not use Pages for shared functionality.
7. Keep PR #1 draft and the muscle selector deferred until LIVE-VERIFICATION.md passes, including the physically checked first publication and an unchanged map after subsequent draft edits.

## Continuous development

```sh
nvm use                 # if using nvm; Node 24 is already active here
npm ci                  # when dependencies are missing or the lockfile changes
npm test
npm run build
npm run dev             # http://127.0.0.1:4173/
```

The dev server uses separate local SQLite `.gym-dev.sqlite` (override with `GYM_DEV_DB`) and a loopback-only test identity. A disposable-database HTTP smoke check passed for all three pages, geometry/catalog assets, local owner access, anonymous staff rejection and empty local drafts/current. The check server was stopped and its disposable database removed. Never expose the dev server publicly. Build outputs/local databases are ignored. No production migrations were generated/applied. Production writes, deployment, merges and removal of older implementations remain deferred.

## Development progress

- `88b6785`: reviewed and committed the five environment/documentation files after all 37 Node tests and the Worker build passed.
- Added `AGENTS.md` and `BACKLOG.md` to guide incremental local implementation. The branch comparison above remains the original reconciliation snapshot; new progress is recorded here.
- Reconciled workout-branch implementation into the shared source without merging branches or replacing catalog code: corrupt-record recovery, idempotent recovery imports that preserve newer edits, map layering/selection, concurrent publication retries, public-field filtering and equipment availability controls. Added the read-only workout API and its integration guide; it returns unavailable without `WORKOUT_API_TOKEN_SHA256`. No production secret or access policy changed. All **46 Node tests**, application/service syntax checks and the Worker build pass. The separate layout-instance/physical-inventory contract remains a catalog milestone.
