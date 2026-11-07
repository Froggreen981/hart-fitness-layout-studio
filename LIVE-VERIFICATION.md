# Shared-layout release verification

The staff workspace is live at https://gym.huffworkshop.com/workspace.html with its custom visitor audience. Source changes are tracked in PR #1 in Froggreen981/hart-fitness-layout-studio. The current gym map awaits a verified equipment arrangement.

## Owner and manager setup

1. The owner session, the manager's **Edit drafts** role, and the manager's Site visitor grant are confirmed. Application staff permission and Site visitor permission are separate.
2. Have the manager open the workspace in their own signed-in browser. Confirm they can open drafts and that the workspace omits publishing and owner staff controls.

## Real layout and persistence

1. At the original planner address, export useful browser layouts as JSON. Keep the exported backup. Browser saves do not transfer between domains or profiles automatically.
2. In Shared layouts, use **Import JSON** to create new drafts while preserving existing ones. To build the arrangement from the floor plan, use **New Hart draft** and record equipment by area during the walkthrough. Capture each machine's name, footprint, position and orientation. The building drawing supplies the room geometry. The walkthrough supplies the current equipment positions.
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

- 30 Node test files/subtests pass, including the existing inline geometry, editing, storage, import and print-region assertions.
- Tests cover two staff roles, recoverable stale saves, SQLite persistence, simultaneous publication conflicts, immutable history, imports beyond 100 drafts, the latest Hart geometry and deployable Worker entrypoints.
- Shared-editor regression tests cover undo while a save is in flight and retry after a lost response while a newer edit is pending.
- Deployed D1 has the four expected tables.
- Live public snapshot reads work through the authorized service boundary; staff endpoints reject identity-less requests with 401.
- Forged owner headers through Sites dispatch receive 401.

## Live browser progress

Two owner browser tabs verified persistent D1 saves after reload, rejection of a stale save, and an available recovery action. The BYU-Idaho planner renders the corrected Hart wall geometry, including the lower CrossFit opening and blocked man door. The manager's independent sign-in and the first physical-state publication are the remaining live checks.
