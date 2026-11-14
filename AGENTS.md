# Gym Layout Studio development

- Read `DEVELOPMENT-STATUS.md` for persistent project status and `BACKLOG.md` for priorities. Update status after completed milestones, including checks and remaining blockers.
- GitHub is the authoritative source. Develop on `codex/shared-gym-layouts`; preserve useful work on other branches. ChatGPT Sites is the existing deployment target, not an automatically synchronized checkout.
- Work incrementally and commit completed, tested changes. Do not deploy, merge into `main`, change Site access/secrets, write production D1 data, or publish an unverified gym map unless the user later authorizes that specific action.
- Use Node 24 (`.nvmrc`), `npm ci` when dependencies are missing, `npm test`, and `npm run build`. Run browser tests when changing browser behavior. Keep test databases disposable and separate from `.gym-dev.sqlite` and production.
- The development server binds to loopback and injects test identities. Never expose it publicly or put test identity handling in the Worker. Production authentication trusts identity headers supplied by Sites dispatch; preserve that boundary.
- Preserve recovered Hart geometry, v1/v2 data compatibility, browser saves, storage inventory, custom templates and shared-draft recovery. Imports create separate shared drafts; publications remain immutable snapshots with role, physical-state and revision checks.
- Equipment `id` identifies a layout instance; `inventoryId` identifies a surveyed physical unit; `catalogId` identifies its model group. Do not conflate them. Duplicating equipment must clear physical inventory assignment. Linking model metadata must not move or resize existing equipment.
- Keep manufacturer specifications and on-site verification distinct. Retain source links, original units, probable/unknown model status, and operator control of actual footprints. Never fabricate dimensions, equipment positions or exercise compatibility.
- Browser automation must use local fixture data. Hosted staff/device QA, verified production backups and the first physically checked publication remain separate release requirements in `LIVE-VERIFICATION.md`.
