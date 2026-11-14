# Update the existing Gym Layout Studio Site

This runbook prepares a code update, not a new gym-map publication. **No production deployment, runtime-setting change, D1 write or merge into `main` is authorized yet.** GitHub remains authoritative; Sites remains the deployment target.

## Verified target and baseline

| Item | Value to retain |
| --- | --- |
| GitHub repository / development branch | `Froggreen981/hart-fitness-layout-studio` / `codex/shared-gym-layouts` |
| Existing Site | `appgprj_6ae42d870d0481918f92cb6a7697a4d6` |
| Live staff workspace | https://gym.huffworkshop.com/workspace.html |
| Site-owned source branch | `main` in the separate Sites repository; this is **not GitHub `main`** |
| Live saved version / source | 13 / `c6920abd0815145bb956dacc364331cacb463695` |
| Verified GitHub equivalent | `5f6db7a285d7b0f28be9a183f4ab73607895da23` |
| Identical baseline source tree | `68036a3c8094ab0cec8048c0f92040eadd23e7c6` |
| D1 / R2 / hosting | `DB` / `null` / Worker, with no `static` entry |
| Runtime identity setting | Existing secret `STAFF_OWNER_EMAIL`; preserve its value |
| Audience/domain | Preserve existing custom visitor policy and domain/TLS |

The Sites repository was cloned read-only using an ordinary short-lived source credential with no publish-on-push opt-in. Its HEAD matches saved version 13, and its entire tree matches the GitHub baseline above. Current manifest, schema, SQL, Drizzle journal/snapshot and building geometry are identical to that source. `npm run release:check` enforces the pinned hashes in `release/sites-v13-baseline.json`. **No schema migration is introduced by this release.**

Sites still reports four user tables: `gym_drafts`, `gym_staff`, `gym_publications`, `gym_imports`. The owner-email secret key is present, but its value is masked by the read API; masking does not mean it is empty. Current visitor metadata lists only the owner, whereas a separate application editor role was previously confirmed. Do not change either permission layer as a side effect of deploying code.

## Preparation completed independently

```sh
nvm use
npm ci                       # if dependencies are missing or changed
npm run release:check
npm test
npm run build
npm run test:browser
npm run test:browser:worker
```

The browser commands run the same desktop/mobile flows against two disposable local databases: first the source development server, then the actual embedded Worker. The test transport injects fixture identities outside the bundle. It cannot use production D1, and the built Worker is checked for local identity/SQLite/schema code. Upgrade tests preserve old drafts/revisions, archives, roles, import receipts and immutable publications, including after an explicit edit to a separate fixture draft.

From a clean, normally pushed development branch, create a local audit candidate:

```sh
npm run release:prepare
```

This verifies the GitHub remote HEAD, runs all checks above, and writes `build/releases/<full-github-sha>/candidate.tar.gz` plus `release.json`. Metadata records the GitHub commit/tree, baseline hashes, Worker SHA-256, archive SHA-256 and passing commands. Only the manifest, Worker and existing migration SQL/journal/snapshot enter the archive; no SQLite, `.env`, staff rows, browser recovery, credentials or test artifacts are included. Older candidate directories are retained. It makes no Sites push, version save or deployment.

The candidate is a local review artifact. The native Sites publication must use source synchronized to the Site's own configured branch, its **Sites commit SHA**, and the matching archive returned by the supported Sites source workflow. Never substitute a GitHub SHA for a different Sites SHA merely because the files match.

## Actions still required before production authorization

1. **Obtain a supported full D1 backup or restore point and verify how to restore it.** Have the Site/host operator include all four user tables and migration bookkeeping. The available Sites data tools provide bounded, possibly truncated row views, not a lossless backup/restore operation. Browser JSON exports and source archives are useful additional backups but do not replace a D1 backup. Record the backup/restore-point identifier privately and the current draft IDs/revisions, staff roles, publication IDs and migration ledger. Do not paste staff data or secrets into this repository.
2. **Confirm the initial migration is already recorded as applied.** The version-13 deployment and schema match this release, but the public database-overview tool does not expose the platform's migration ledger. Verify it with the host operator. Do not regenerate, edit, replay, drop or reseed `0000_shared_layouts.sql`; a code deployment must retain the existing database resource behind `DB`.
3. **Verify an authorized live owner session and permitted direct access to the hostname.** Confirm existing shared drafts and roles before release. Resolve or explicitly record the manager's visitor-access discrepancy; their D1 editor role alone does not grant Site access. Any invitation/access change requires separate authorization. This environment's direct HTTPS access was blocked, and local fixture identities do not verify Sites dispatch.
4. **Make the supported Sites source workflow helper available.** Native source access works, but `scripts/site-workflow.mjs` from the Sites plugin is not installed in this execution workspace and could not be read from the cloud skill's resources. Use a deployment-capable environment with the official helper. Do not install a new Site or change identity to work around this tooling gap.
5. Review the exact candidate commit/hash and obtain authorization for the existing-Site code deployment. Workout integration enablement and publishing the real equipment arrangement are separate actions; neither is needed to deploy updated planner/catalog code. An empty current map and the API's `no_publication` response are valid until staff verify the physical arrangement.

## Authorized release procedure

Follow the Sites skill's existing-Site source workflow. `<plugin-root>` below is the installed Sites plugin path in that environment; use actual returned checkout paths and opaque IDs rather than inventing them.

1. Refresh `get_site` for the exact project above, `list_site_versions`, `list_custom_domains`, the runtime-setting **key names**, and `read_database_overview`. Preserve project, domain, D1 resource/binding, owner secret and audience. Confirm no unrelated release has advanced Sites source/version since preparation; reconcile differences before proceeding. Recheck GitHub branch HEAD and CI.
2. Call `create_source_repository_write_credential` with that `project_id` and `publish_on_push: null`. Keep the returned credential only in session memory, never logs, files or command arguments. **Do not request automatic private publication.** If the response reports an active/accepted automatic-publication window, stop before pushing and reconcile it; a false response does not cancel an earlier window.
3. In a new isolated staging directory, open the existing source with the official helper:

   ```text
   node <plugin-root>/scripts/site-workflow.mjs --project-id appgprj_6ae42d870d0481918f92cb6a7697a4d6
   ```

   Launch in a retained TTY. After its hidden-stdin prompt, send `{ "credential": <returned credential> }` through stdin, with no `archivePath`. Retain the complete returned opening result and its `checkout_path`.

4. Overlay the exact reviewed GitHub tracked source into that **isolated Site checkout**, preserving its `.git` and helper state. For this baseline there are no deleted tracked files to reconcile; verify that remains true. One way to transfer the tracked files is:

   ```sh
   git -C "$GITHUB_CHECKOUT" archive "$REVIEWED_GITHUB_SHA" | tar -x -C "$SITE_CHECKOUT"
   ```

   Use verified absolute paths and a full reviewed SHA. Do not copy a whole workspace, `.git`, `node_modules`, local databases, `.env`, exports, caches or test results. Recheck the release contract in staging. Review the diff against the previous Sites source; retain `project_id`, `DB`, schema and migration files unchanged. If source history advanced, preserve that work and reconcile instead of force pushing or resetting its remote.

5. Run the official helper from its returned checkout with hidden stdin containing the credential, **complete opening result as `source`**, an absolute archive output path, and these ordered `commands`:

   ```json
   [
     ["npm", "ci"],
     ["npm", "run", "release:check"],
     ["npm", "test"],
     ["npm", "run", "build"],
     ["npm", "run", "test:browser"],
     ["npm", "run", "test:browser:worker"]
   ]
   ```

   The helper owns commit/push/packaging. Keep its final `project_id`, full Sites `commit_sha` and `archive` unchanged. Verify the resulting Sites source tree equals the reviewed GitHub `source_tree` and that `dist/server/index.js` hashes to the local candidate's Worker SHA-256. If either differs, investigate and rebuild; do not label the result synchronized. Record the GitHub-to-Sites SHA mapping and archive hash.

6. Call `save_site_version({project_id, commit_sha: <returned Sites SHA>, archive: <returned absolute archive path>})`. This saves a version; it does not deploy. Retain the returned saved-version ID and human version number. Do not assume a source push alone updates the website.
7. **Only with production authorization**, deploy that exact saved version. Refresh audience first: if Sites verifies the caller is the sole allowed owner/viewer, use `deploy_private_site_version`; otherwise use `deploy_site_version`. Do not change audience to qualify for an operation or probe access with a deployment. The last recorded policy is custom with only the owner listed; it must be checked again at release time.
8. Poll `get_deployment_status` using the new returned deployment ID until success/failure. Keep version 13 available for code rollback. Do not merge GitHub `main`, dispatch the Pages workflow, create a Site, create a replacement D1 database or publish a gym arrangement as part of this procedure.

## Read-only checks immediately after deployment

- At `https://gym.huffworkshop.com/workspace.html`, verify authorized owner sign-in, visible pre-existing drafts/revisions and correct role. Confirm Site visitors still pass the intended gate and unauthorized staff requests are rejected. Repeat the manager's own session when access is confirmed.
- Open a known draft, inspect geometry/catalog controls, and reload **without making edits**. Compare IDs/revisions/counts against the pre-release record. Confirm the existing browser-storage origin/key are unchanged and the model checklist opens at `equipment-checklist.html`.
- Confirm the current publication ID/history and positions are unchanged, or that the map still reports no publication. Never publish a test/sample layout to make this check pass.
- The workout API should still return `503 integration_unavailable` if its separate digest was never configured. Record the saved version, deployment ID, GitHub/Sites SHA mapping, Worker/archive hashes and findings in `DEVELOPMENT-STATUS.md`. Additional production write tests require authorization for a disposable test draft.

## Workout API activation is a separate rollout

Deploying API code does not enable it. After separately approving the backend integration, verify supported Site service access at this custom-audience hostname and keep `STAFF_OWNER_EMAIL` untouched. The backend holds its own random token; Sites receives only the corresponding SHA-256 digest as `WORKOUT_API_TOKEN_SHA256`. Use an approved platform service credential only for this Site via `OAI-Sites-Authorization`, and the separate workout token via `Authorization`. Never put either token in browser code or widen the Site audience. Do not generate/rotate a platform bypass token unless explicitly requested.

Verify disabled/missing/invalid credentials, cross-origin denial, staff-permission separation, conditional reads, and exact published equipment IDs/positions. Until a physically checked map is deliberately published, authenticated `404 no_publication` is expected. Reviewed exercise-to-equipment mappings remain the workout application's responsibility; catalog suggestions do not certify compatibility.

## Code rollback

With rollback authorization, redeploy the retained version-13 saved version:

`appgprj_6ae42d870d0481918f92cb6a7697a4d6~appgver_04426369c27081919e4e41ed8a268ff2`

Use the same project and the current audience-appropriate native deployment operation. This release makes no schema changes, so code rollback does not require reverting tables or overwriting newer drafts with an old database backup. Recheck sign-in, drafts and current publication after rollback. A failed deployment can apply pending migrations before Worker upload; investigate actual migration state before any retry if the verified no-migration contract was changed.
