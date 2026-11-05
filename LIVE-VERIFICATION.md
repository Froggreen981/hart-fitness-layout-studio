# Shared-layout release verification

Deployed: Sites version 11, November 5, 2026. Existing Site and audience retained. Source: PR #1 in Froggreen981/hart-fitness-layout-studio. No actual-state arrangement has been published.

## Owner and manager setup

1. Open the deployed Gym Layout Studio and complete ChatGPT sign-in as the existing Site owner. The shared workspace is the home page; `workspace.html` opens it directly. The page must show your account and **Staff access**. A 403 means the signed-in account does not match the configured owner or staff allowlist.
2. Obtain the manager's exact ChatGPT sign-in email. In **Staff access**, add it with **Edit drafts**, the selected role.
3. In the Site access settings, add that same manager as an allowed visitor. Application staff permission and Site visitor permission are separate. Do not grant source-editor access to use the gym planner.
4. Have the manager open the Site in their own signed-in browser. Confirm they can see drafts and cannot see publishing or owner staff controls.

## Real layout and persistence

1. At the original planner address, export useful browser layouts as JSON. Keep the exported backup. Browser saves do not transfer between domains or profiles automatically.
2. In Shared layouts, use **Import JSON**. This creates new drafts and preserves existing drafts. **New Hart draft** can create an unpublished reference floor plan if no equipment arrangement is ready.
3. Open a draft, move a machine, and wait for **Saved to shared workspace**. Close it, reload, and reopen in a different signed-in session. The saved position must persist.
4. In owner and manager sessions, open the same saved draft before either edits it. Save from the owner. Then save a different change from the manager. The second save must show a conflict and retain its recovery copy. **Save recovery as separate drafts** must create a separate proposal without replacing the first save.

## Protected publication and read-only map

1. Confirm the manager/editor cannot publish. API tests already verify server-side rejection of editor publish requests; repeat it under the real manager identity before release.
2. Check the chosen arrangement against the physical gym. In the owner session, choose **Publish**, review the name, and confirm actual physical state. Without the checkbox, publication must not proceed.
3. Open **Current gym map**. Check the square lower-right corner, lower CrossFit opening, blocked man door, wall projections, three half walls, area labels and machine positions. There must be no equipment editing controls.
4. Edit and save the source draft again. Refresh the map. It must still show the published positions until another deliberate publication.
5. Open a publish dialog, change/save that draft in the other session, then submit the old dialog. It must reject the stale draft revision. Similarly, an older publish dialog must reject after a different current map is published.
6. Verify archive, duplicate, rename, history restore and recovery behave as documented. Restore appends history. Archiving a draft must not remove its existing publication.
7. The Site currently retains its custom visitor audience, so the map requires an allowed visitor account. Opening it to anonymous patrons is a separate Site audience decision, after staff access and publishing have passed these checks.

## Merge gate

Record the two verified identities/roles without passwords or session data, the verified draft revision/publication ID, browser findings and passing CI. Only then merge PR #1. The muscle selector stays deferred.

## Completed automated/hosted checks

- 28 Node test files/subtests pass, including the existing inline geometry, editing, storage, import and print-region assertions.
- Tests cover two staff roles, recoverable stale saves, SQLite persistence, simultaneous publication conflicts, immutable history, imports beyond 100 drafts, the latest Hart geometry and deployable Worker entrypoints.
- GitHub Shared layout verification passes.
- Deployed D1 has the four expected tables.
- Live public snapshot reads work through the authorized service boundary; staff endpoints reject identity-less requests with 401.
- Forged owner headers through Sites dispatch receive 401.

## Browser limitation in the authoring session

Managed local preview reported a URL, but the browser connection was refused. Hosted sign-in advanced to an OpenAI passkey verification screen. Signed-in rendering, real two-account persistence and actual-state publishing are still unverified.

## Live progress after owner sign-in

The owner session is verified in the deployed browser. The manager has application editor permission and Site visitor access. The manager has not yet signed in for independent testing.

Two owner browser tabs verified persistent D1 saves after reload, rejection of a stale save, and an available recovery action. The BYU-Idaho planner and latest Hart wall geometry render in the live browser. A save-button state bug found during that testing is fixed: save controls are notified after the request finishes. A regression test covers the final idle state.

The live current publication remains empty. Test drafts are unpublished and can be archived. Real manager-session verification and publication of a physically checked arrangement are still required before merging.
