# Workout-team acceptance — API v1 / contract revision 1.0.0

**Ready for offline evaluation; external-team acceptance has not been given.** Fixtures and review records in tests are fictional. Do not copy them into production exercise mappings.

## Run independently

Use Node 24. Copy this directory with its relative modules intact, install `ajv@8` and `ajv-formats@3` in the backend, or use the repository:

```sh
npm ci
npm run test:consumer
```

The repository harness makes no production request and needs no credentials. Seven HTTP response fixtures (including a second publication) are listed in `fixtures/index.json`; the mapping exchange is separate. `response.schema.json` remains revision 1.0.0, with equipment identity checks in `snapshot.mjs`. Consumer cache/identity fixes do not change the HTTP response schema or API version.

## Acceptance cases

| Case | Required result | Available evidence / team action |
| --- | --- | --- |
| Contract | Layout/equipment/error fixtures validate against JSON Schema 2020-12; unknown additive fields can be ignored. Old publications may omit model/physical metadata. | Offline harness validates all seven responses and actual API projections. Run the same fixtures through the team's own deserializer. |
| Identity | Join workouts to exact layout-instance `id`; never substitute `inventoryId`, `catalogId` or a name. Reject ambiguous instance/assigned-physical identities before mapping or highlighting. | Shared index checks now cover the backend client and independently called mapping/highlight helpers. Team confirms its persisted reference format. |
| Exercise review | Real exercise IDs, candidate units, alternatives, mapping version and review reference must be jointly reviewed. A `reviewed` string cannot establish human review. | `fictional-mappings.json` is rejected by normal use. **Real IDs, compatibility evidence and review ownership remain pending.** |
| Empty/unavailable/missing | `404 no_publication` differs from a valid empty publication. Exclude out-of-service items; keep absent IDs unresolved without guessing storage/removal or substituting by model. | Offline cases cover missing and unavailable items. Team confirms its failure/selection UI. |
| Publication refresh | Replace the complete snapshot together. A stable ID can move/rotate; a removed ID stays missing. Flag saved workouts and revalidate mappings against a changed publication. | `populated-layout.json` → `refreshed-layout.json` moves rack A to a 45° footprint, removes bike B from the floor and adds unavailable rack C. Harness checks changed publication, exact new positions and unresolved references. |
| Cache | Revalidate a private cache per origin/credential. Reuse `304` only when a valid ETag was actually sent; reject contradictory tags. Do not retain `no-store` responses. Clear stale guidance after upstream/auth/schema failures. | Harness covers cache isolation, concurrent requests, 200/304, weak/strong tag equivalence, unsolicited/mismatched 304, no-store, timeout and invalid responses. Team agrees on bounded refresh/backoff and failure behavior. |
| Backend authentication | Keep the independent workout credential and any approved Site gateway credential in the backend; never relay them to a browser or another host. Workout credentials must not authorize staff writes. | Existing local API tests cover isolation/denial. **The actual gateway/credential path remains a separately authorized rollout.** |
| Highlighting | Draw the returned room/wall/area/obstacle/equipment polygons in feet, Y down. Use returned footprints directly, including 90° and 45° cases; do not rotate them twice. Highlight available exact IDs in a separate overlay without mutating the official snapshot. Escape names as text and distinguish status beyond color. | Harness checks available/missing/unavailable joins and snapshot immutability. **Visual/interaction acceptance in the team's renderer remains pending.** |

## Record before calling the integration accepted

Keep this review record in the workout team's project, without secrets:

- Gym and workout repository commits; schema revision 1.0.0; consumer test/renderer results.
- Agreed exercise-ID namespace, actual mapping version, compatibility evidence/review reference and reviewer ownership.
- Publication ID and selected instance IDs used by the reviewed workout; availability/stale-publication decision.
- Approved user audience, backend origin, refresh/backoff interval, timeout and error UI.
- Backend credential/gateway verification reference, with **no credential values**.
- Explicit team acceptance or unresolved exceptions; leave acceptance pending until reviewed.

Production activation additionally requires the authorized existing-Site code release, supported D1 backup/ledger checks, real staff sessions, physical equipment verification and deliberate owner publication. An unavailable or empty current map is valid until then. Do not publish a fictional arrangement to complete acceptance. See `README.md`, `../../OPERATIONS-HANDOFF.md` and `../../RELEASE-PLAN.md`.
