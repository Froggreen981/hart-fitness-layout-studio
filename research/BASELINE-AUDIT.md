# Dimension research baseline

Reviewed November 22, 2026 at `4f13c2d02b6fde4f724ab7576207d76e5538bd07` on `codex/shared-gym-layouts`.

- Catalog: 95 groups, 155 distinct physical inventory IDs.
- Dimensions present: 20 groups, representing 25 units.
- Dimensions absent: 75 groups, representing 130 units.
- Planner and checklist inspect the same catalog; the reported local count of 23 could not be reproduced. Its build or counting rule is unknown.
- Model confidence describes identification, not dimensional measurement or placement verification.

`equipment-identities-baseline.json` preserves every original group's ID, manufacturer, model/confidence, candidates, quantity, physical IDs, name, area and notes. `dimensions-baseline.json` preserves every existing dimensional value and attribution. Later research must retain those values unless authoritative correction evidence is documented.

Baseline validation completed on Node 24: dependency installation, 88 Node tests, release contract and Worker build. Research additions and the final inventory are documented separately in `DIMENSIONS-RESEARCH.md` at the repository root.
