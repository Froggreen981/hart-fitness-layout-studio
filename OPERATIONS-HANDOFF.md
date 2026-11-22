# Gym Layout Studio operational handoff

Current development branch: `codex/shared-gym-layouts`. GitHub remains authoritative. This handoff does not authorize production writes, deployment, access/credential changes, publication or merge.

## Verified development deliverables

- Release contract pins the existing Site, `DB`, schema/migrations and corrected building geometry. Upgrade tests preserve legacy drafts/revisions, archives, roles, import receipts and immutable publications. Candidate preparation retains completed archives atomically; read-only preflight checks exact archive membership, source/build hashes and GitHub provenance.
- Workout API v1 is disabled without its separate runtime digest. GET, HEAD and conditional requests validate readable snapshot data before success. The offline [consumer integration kit](integration/workout-v1/README.md) provides contract revision 1.0.0 schemas, fictional responses/mappings, a tested backend cache client, rendering/ID/availability/stale-workout guidance and mapping review validation.
- The 95-group / 155-unit phone checklist preserves v2 backups/progress and adds follow-up/confidence/source-dimension filters, area reports, recoverable clear/restore and tab updates. Group observations never verify every physical unit or update official records.
- Staff create/duplicate/import actions retain operation IDs for same-tab lost-response retries. Existing save/recovery/conflict/publication boundaries remain intact. Geometry, equipment coordinates/rotations/IDs, storage, templates and original browser saves are preserved.

Use `DEVELOPMENT-STATUS.md` for exact local/CI results and history. `RELEASE-VERIFICATION.md` provides executable GET-only before/after checks, and `integration/workout-v1/ACCEPTANCE.md` supplies the external-team checklist. The release candidate's `release.json` records the specific GitHub commit/tree, Worker/archive hashes and repeated passing commands. `npm run release:preflight -- --remote --candidate build/releases/<full-sha>` audits it without production writes. Local readiness does not approve production.

## Production evidence and limits

Read-only Sites metadata on November 21, 2026 (America/Denver) still reports saved version **13**, source `c6920abd0815145bb956dacc364331cacb463695`, with its retained successful deployment. The custom domain/TLS remain active. The recorded version-13 source tree equals GitHub `5f6db7a`; this is previously verified source equivalence, not a new deployed-byte comparison. New development commits are **not deployed**.

The visitor policy remains custom with only the owner listed and zero external visitors. A previously confirmed application editor role does not establish manager Site visitor access. No real staff session or physical walkthrough was performed in this continuation. A bounded read confirms one application editor and zero publications; the editor account is absent from the listed visitor policy. Draft contents and the private migration ledger were not exported. The official Sites source helper is unavailable here; its cloud script resource could not be read. Do not improvise a deployment path.

## Ordered operational gates

| Step | Owner action and required evidence |
| --- | --- |
| 1. Preserve data | Host operator obtains a supported **full D1 backup/restore point**, including migration bookkeeping, and verifies a supported restore procedure. Keep the identifier/private inventory of existing revisions, roles, receipts and publications outside source control. Bounded row views and browser exports do not replace a database backup. |
| 2. Confirm migration state | Verify `0000_shared_layouts.sql` is already applied in the actual platform ledger. Retain the existing database resource behind `DB`. Do not regenerate/replay the initial migration, drop tables or reseed data. This code release has no schema change. |
| 3. Verify staff access | Use the live owner's own signed-in session to confirm existing drafts/role. Verify the manager independently passes **both** the Site visitor policy and application editor role; editors must lack publication/owner controls. Resolve any invitation/access change only under separate authorization. |
| 4. Review exact candidate | Refresh GitHub HEAD/CI, Sites source/saved version, audience/domain and database binding. Audit the clean pushed candidate and any source changes since version 13. Obtain code deployment authorization for that exact candidate. |
| 5. Synchronize supported source | In a deployment-capable environment, use the official Sites existing-project helper and the same project identity. Reconcile advanced source history. Record distinct GitHub and Sites commit IDs, source-tree equality and matching Worker hash. Avoid automatic publication on push; retain the helper's exact archive/provenance. |
| 6. Save/deploy code | Follow `RELEASE-PLAN.md`: save the exact supported archive/version and deploy it only when authorized under the unchanged audience. Retain version 13 for code rollback. Never create a replacement Site/D1, widen audience or publish a test gym arrangement. |
| 7. Check read-only behavior | Verify owner/manager access, pre-existing draft IDs/revisions, geometry/catalog entrypoints, browser-origin storage, unchanged publication/history (or valid empty state), and disabled API if its digest is absent. Record deployment/version/hash mapping. Production write tests require separate authorization for a disposable draft. |
| 8. Verify physical gym | Staff walk through the actual gym with phones. Check each unit/model and unresolved measurements, footprints, floor/storage locations, rotations, physical IDs and availability. Keep JSON backups/report exports. Engineering geometry is estimated, not proof of current machine placement. |
| 9. Publish official map | After physical verification, the authorized owner/publisher deliberately confirms the arrangement and saved revision/current ID. Record the immutable publication ID; verify later draft edits leave it unchanged. Code deployment and this publication are independent actions. |
| 10. Enable workout integration | Agree on the external backend audience and supported Site gateway path. Separately authorize credential setup, verify gateway plus workout credential isolation, denial/conditional/error behavior, and exact published positions/IDs. Jointly review exercise mappings; fictional examples are not production mappings. |
| 11. Review merge | Record live staff checks, physical publication evidence and passing exact-head CI in `LIVE-VERIFICATION.md`; obtain merge authorization. PR #1 stays draft until those gates pass. PR #2 is a conflicting historical stacked branch whose useful changes are reconciled; review its retirement separately instead of merging it blindly. |

## Failure and rollback notes

An interrupted local candidate may leave `.gym-candidate-*` staging directories; only the complete archive plus metadata is reviewable. Existing completed candidates are not overwritten. Audit the pair and refresh GitHub/Sites state before resuming. If a deployment fails, inspect native deployment/migration state before retrying, especially if any no-migration invariant changed. Partial source preparation is not a successful saved version or deployed release.

Code rollback redeploys the retained version-13 saved version under the current unchanged audience. Because schema is unchanged, do not overwrite newer D1 data with an old backup for a code-only rollback. Version 13 lacks newer physical-ID and catalog-publication safeguards: coordinate a staff editing/publication pause and perform only read-only checks until forward recovery. A database restore is a separate, explicitly authorized recovery operation. See `RELEASE-PLAN.md` for exact IDs and native steps.

## Prioritized owner/host actions

1. Ask the Sites host operator for a supported full D1 backup/restore point and a verified restoration procedure. Request confirmation of the existing database resource behind `DB` and the applied `0000_shared_layouts.sql` ledger entry/hash, including migration bookkeeping. Record retention/restore-point details privately. Do not substitute a bounded row export or rerun the SQL.
2. Establish an approved read-only route/session for the existing hostname and perform the actual owner/manager device procedure. Confirm the intended manager account, then separately authorize its Site visitor/viewer grant if appropriate; retain its existing application editor role. Environment network access, Site visitor access and application roles are three distinct checks.
3. Make the official Sites source helper available in a deployment-capable environment. No credential was refreshed here. The future credential/source-push operation must be explicitly authorized; use `release:compare-source` with the official returned checkout/commit and reviewed candidate before any native save/deployment.
4. After backup/ledger/access/tooling gates, authorize the exact candidate and necessary source/version/deployment steps. Run exact-asset and before/after read-only smoke checks. Keep a rollback staff pause ready: version 13 preserves newer rows on reads but lacks the later physical-ID and catalog-publication safeguards, so editing/publication must stay paused until forward recovery. No production database restore is part of code rollback.
5. Give the workout team `integration/workout-v1/ACCEPTANCE.md` for offline evaluation. Actual exercise mappings, renderer signoff, gateway/credential activation, physical survey and deliberate first map publication remain separate reviews/actions. PR #1 stays draft/unmerged until its operational gates and merge authorization are satisfied.

## Next development milestone

Have the workout team run `npm run test:consumer` and review the schema/mapping exchange; agree on exercise IDs, review ownership, missing/out-of-service behavior, refresh/backoff and failure UI. Add only jointly reviewed mappings and consumer contract regressions. In parallel, schedule the separately authorized release/staff-device gates above and the physical survey. Remaining unknown model/dimension research must retain source links and uncertainty; do not fabricate exercise compatibility or placement.
