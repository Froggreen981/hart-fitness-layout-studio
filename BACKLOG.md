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
- [ ] Complete `LIVE-VERIFICATION.md` before considering PR #1 merge or the patron muscle selector.
