# Read-only release verification

The `release:smoke` utility records HTTP evidence before and after an authorized code deployment. Every request is **GET**, redirects are not followed, targets stay on one validated origin, bodies/time are bounded, and failures do not expose upstream bodies or credentials. It creates no draft, staff role, import, publication or database schema.

It checks the reported owner/editor/publisher role, UI assets, active and archived draft metadata, publication history/current map, selected existing draft fingerprints, owner-only role visibility (or editor/publisher denial), and the candidate's disabled workout API. Reports contain hashes rather than names, email addresses, notes or raw draft documents. Treat reports as private operational records and keep them under ignored `build/verification/`, not source control.

## Before and after capture

```sh
mkdir -p build/verification
npm run --silent release:smoke -- --origin https://gym.huffworkshop.com --profile baseline --expected-role owner > build/verification/before.json
npm run --silent release:smoke -- --origin https://gym.huffworkshop.com --profile candidate --expected-role owner --candidate build/releases/<full-github-sha> --before build/verification/before.json > build/verification/after.json
```

The baseline profile checks the existing version-13 UI/API surface and skips the not-yet-deployed workout endpoint/checklist. Candidate preparation now stores `static_assets` fingerprints in `release.json` without adding files to the deployment archive. The candidate profile with `--candidate` compares every public asset's decoded response bytes and MIME type to those fingerprints, detecting stale or wrong assets despite HTTP 200. Older candidates without fingerprints can still be audited by preflight but must be prepared at the current reviewed commit for this exact-assets smoke mode.

CLI exit codes: **0** passed; **1** failed; **2** blocked/incomplete. A gateway redirect, HTML login response, denied/network request, missing real staff session or bounded pagination limit must never be recorded as a successful release. Increase `--max-pages` deliberately if needed (default 4; maximum 100). Optional repeatable `--draft-id <existing-id>` captures up to ten selected document fingerprints. Use the same IDs, role, origin and page bound before/after. A complete metadata capture is still **not a full database backup or migration-ledger verification**.

The CLI uses Node 24's `--use-env-proxy` to retain the environment's proxy/CA policy. It has no credential input or impersonation flags. In an environment without an approved authenticated outbound session, the CLI will correctly report blocked. Do not copy browser cookies, fake Sites identity headers, generate bypass credentials, change the audience, or bypass a denied hostname to make it pass. The current Cloud environment's proxy denies the gym hostname; actual live owner authentication remains unverified here.

## Authenticated staff harness

The same module exports `readOnlySmoke` and `compareReadOnlyEvidence`. An authorized QA harness can supply its existing approved staff-session transport in memory. For example, with a real, already authorized Playwright browser context:

```js
import {readOnlySmoke} from './scripts/read-only-smoke.mjs';
const report = await readOnlySmoke({
  origin: 'https://gym.huffworkshop.com',
  expectedRole: 'editor',
  assets: candidateMetadata.static_assets,
  fetchImpl: async (url, options) => {
    if (options.method !== 'GET') throw new Error('Read-only checks only');
    const response = await approvedStaffContext.request.get(url.href, {
      maxRedirects: 0, timeout: 10_000
    });
    return new Response(await response.body(), {
      status: response.status(), headers: response.headers()
    });
  }
});
```

`approvedStaffContext` is supplied by the operator's authorized tooling; the module does not create, export or acquire a login. The automated repository tests use the existing disposable owner/editor fixtures instead. Those tests do not prove that real staff can pass Sites dispatch. Every report therefore leaves `platform_identity_verified: false`; the independent real-device sign-in procedure in `LIVE-VERIFICATION.md` supplies that evidence.

## Assessing results

Require a passed candidate report with `asset_hashes_verified: true`, a passed before/after preservation comparison, a successful exact saved-version deployment and matching GitHub/Sites source plus Worker hashes. Static hashes alone cannot prove server Worker byte identity; reports explicitly leave that separate gate false. A mismatch or blocked report is an investigation gate, not authorization to restore a database, change access or republish a layout.

Preservation comparison covers captured active/archived metadata, roles, history/current publication and explicitly selected draft documents. It rejects different origins/roles, incomplete captures, changed revisions/fingerprints and missing sections. It cannot prove preservation of uncaptured private data, import receipts or migration bookkeeping; retain the separately supported full D1 backup/restore point and existing upgrade regressions.

If a deployment fails, use the returned native deployment ID to inspect terminal status. Do not run writes to diagnose it. Retain the before/after reports and exact candidate/source/version identifiers privately. Follow `RELEASE-PLAN.md` for authorized code rollback to version 13 without replacing newer D1 rows.
