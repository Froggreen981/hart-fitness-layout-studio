# Development backlog

Persistent findings and completed validation live in [DEVELOPMENT-STATUS.md](DEVELOPMENT-STATUS.md). Complete each implementation increment with tests and a commit.

## Current milestones

- [x] Review, validate and commit the recovered environment/development documentation.
- [x] Establish repository instructions and this backlog.
- [x] Reconcile workout-branch recovery, public-map, publication retry and redaction fixes; integrate its disabled-by-default read-only API without changing production configuration.
- [x] Make equipment identifiers and reviewed model/exercise data useful across the editor and published integration; preserve geometry, source provenance and private-field filtering.
- [x] Add Playwright coverage for catalog editing, unique physical IDs, shared persistence/reload, multiple staff sessions, conflict recovery and publishing restrictions using disposable SQLite.
- [x] Fix model-switch metadata and physical-ID validation defects; record passing automated validation.

## Follow-up development

- [x] Port the useful phone model-verification checklist from `main`, preserving browser progress and reconciling it with the catalog.
- [ ] Continue source-backed dimension/exercise research for unknown models; confirm matches and measurements on site.
- [ ] Define reviewed exercise-to-equipment mappings with the workout app; distinguish layout-instance IDs from surveyed physical inventory IDs.
- [x] Add broader browser coverage for storage, printing, touch interaction and keyboard accessibility.
- [x] Add staff inventory search by physical/model ID, exercise metadata, source availability and unassigned units.

## Release blockers (not local development blockers)

- [x] Compare the exact saved Sites source tree with GitHub; pin unchanged identity, D1 schema/migrations and geometry for this code update.
- [x] Add old-database preservation regressions, safe Worker asset packaging, local release candidates and tests against the packaged Worker.
- [x] Document the exact existing-Site source synchronization, version save, deployment, read-only smoke checks and code rollback in `RELEASE-PLAN.md`.

- [ ] Resolve manager Site visitor-access discrepancy and verify their independent signed-in session and editor-only controls.
- [ ] Permit direct hosted owner/manager verification; source comparison is now verified through the read-only Sites clone.
- [ ] Obtain a supported full D1 backup/restore point and confirm the applied migration ledger; bounded data views are not a full backup.
- [ ] Make the official Sites source workflow helper available in the deployment environment, refresh the exact candidate/remote HEAD, and obtain production deployment authorization.
- [ ] Verify the workout backend's Site gateway and separate API credential path in an authorized restricted environment; keep integration disabled until then.
- [ ] Physically check equipment arrangement, then deliberately publish and verify the first current map under the staff workflow. Later draft edits must not change that snapshot.
- [ ] Complete `LIVE-VERIFICATION.md` before seeking PR #1 merge authorization. Workout generation/muscle selection belongs to the external team.

## Continuation increments (November 19)

- [x] Re-run the exact remote baseline on Node 24, review both PRs/current CI and refresh read-only Sites version/domain/audience metadata.
- [x] Add read-only candidate preflight, archive/provenance verification, atomic local preparation and a remote-head recheck after tests.
- [x] Deliver versioned workout response schemas, synthetic fixtures, safe backend cache client and consumer contract harness.
- [x] Close publication-corruption gaps in GET/HEAD/conditional API behavior.
- [x] Improve survey outstanding-work visibility and protect observations against accidental loss.
- [x] Preserve workspace create/duplicate/import operation IDs across same-tab lost-response retries; cover rename/archive/restore/independent duplication in desktop/mobile browsers.
- [ ] Have the workout team run the offline consumer harness and agree on actual exercise IDs, reviewed mappings, audience and refresh/failure policies.
- [ ] Repeat checklist touch/recovery/backup and shared-workspace flows on real staff phones after an authorized existing-Site deployment.

## Exact next milestone

Joint workout-team contract acceptance: run the offline consumer harness, agree on reviewed exercise IDs/mapping ownership and availability/stale-workout policies, then add actual reviewed mapping fixtures and consumer regressions. Production access, credentials and physical publication remain separate operator gates in `OPERATIONS-HANDOFF.md`. No further schema change is needed for the current software release.

## Production-readiness continuation (November 21)

- [x] Reverify `d0c15ad` locally and in GitHub, current Site version/domain/audience, bounded staff/publication state and runtime key names.
- [x] Re-discover supported source/database capabilities and record precise remaining host/session/authorization limits without production changes.
- [x] Add GET-only operational diagnostics, exact asset fingerprints and before/after preservation evidence with source/Worker fixture coverage.
- [x] Add reproducible read-only GitHub/Sites source and rebuilt-Worker comparison for the authorized source handoff.
- [ ] Prepare explicit workout-team acceptance cases/checklist and close demonstrated consumer gaps.
- [ ] Complete the final clean pushed candidate, exact-head CI and staff/host execution handoff.
