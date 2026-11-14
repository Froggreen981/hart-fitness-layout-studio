# Hart Fitness Center Layout Studio

A floor planner and shared staff layout workspace for the BYU-Idaho Hart Fitness Center.

GitHub is the authoritative source repository; continue development on `codex/shared-gym-layouts`. ChatGPT Sites is the existing shared application's deployment target. See [Development status](DEVELOPMENT-STATUS.md) for verified branch differences, deployment provenance and reconciliation gates.

## Editing

- Set rectangular, L-shaped, or traced room dimensions in feet. Edit full-wall and half-wall endpoints and thickness under Walls & half walls. Changing room size does not rescale existing objects.
- The equipment library appears first in the sidebar. Add equipment, obstacles, or areas. Room and wall fields are available only through Facility setup, leaving the everyday workspace uncluttered. Machine drawings use the same SVG icons as the library. Unlock a fixed obstacle before moving or resizing it.
- Drag to move; arrow keys nudge; R rotates 90 degrees. Details accepts any numeric angle. X/Y describe the rotated bounding box. Rotation preserves the center.
- Shift/Ctrl/Cmd-click or Select multiple changes the selection. Dragging a selected member moves unlocked selected objects together. Apply planning buffers to all selected physical objects using independent front, back, left, and right values. The F arrow marks the front.
- Select an area to see eight edge and corner resize handles. Edit contour enables draggable polygon corners and local-coordinate fields. Insert or remove corners with the row buttons. Self-crossing contours are rejected. Contour resizing scales its normalized vertices. Cardio has an optional Hart sketch contour preset; adjust the resulting vertices to measured wall positions.
- Move label enables independent label dragging. Label X/Y and rotation fields position and rotate the name within the area. Labels draw above equipment. Center label resets label placement.
- Ctrl/Cmd + wheel zooms around the pointer. Click and drag empty map space to pan. Unselected area interiors also pan; click an area to select it, then drag it to move. Equipment dragging continues to move equipment. The global Space shortcut was removed, and editable text is excluded from keyboard shortcuts. Fit resets the camera. Normal scrolling remains page scrolling.
- Open the ••• menu beside a saved arrangement, choose Delete layout, then confirm its name. The menu is closed by default. Undo restores a deletion during the session. Keep at least one layout, creating a blank one first if needed. The sketch preset is installed once and will not return after deletion.

## Storage

Storage inventory is a permanent second map beneath the gym map, separate from named areas. It belongs to the selected arrangement. Choose Storage inventory in the library's Add equipment to field to create machines directly in storage, or transfer existing equipment using Details, the storage map button, or the All equipment table.

Stored items keep their last gym coordinates and have independent storage X/Y coordinates. Drag or nudge them on the storage map, edit their dimensions, or return them to the gym. New entries are arranged into available shelf positions. The inventory map fits its contents; its grid uses equipment footprint units but is not a measured storage-room boundary. Floor conflicts, coverage, and Select all equipment exclude stored equipment. Returning resumes floor conflict checks at the previous floor position.

The All equipment table beneath both maps lists every machine's name, footprint, and floor/storage location. It supports search, location filters, selection, and transfers in either direction. Existing addable storage zones migrate to this permanent inventory without losing stored equipment, IDs, dimensions, locks, last floor coordinates, or templates. Old version 2 exports referencing storage-zone IDs remain importable. Permanent storage uses the reserved `@storage` reference and optional finite storage coordinates.


## Printing

Print plan opens region and sheet options. Choose Entire gym, Current view, a named area's bounding rectangle, or a custom rectangle in feet. Choose one sheet or 2×2, 3×3, or 4×4 tiles. Preview pages shows the cropped map and local equipment legend for each sheet. Print / Save PDF invokes the browser print dialog. Print CSS excludes editor UI. Landscape Letter pages are requested; browser/printer settings can override paper and margins. The map fits each sheet and is not a certified engineering drawing scale. Equipment touching multiple tiles appears in each affected sheet's legend. Legend entries group matching equipment names, kinds, and dimensions; the map retains individual names.

## Persistence and compatibility

Layouts and custom Equipment Library templates autosave under the existing localStorage key `gym-layout-studio-v1`. Older version 1 and 2 projects retain IDs, positions, locks, templates, and directional buffers. Polygon vertices, independent labels, storage assignments, and preset-install state are retained in version 2 exports. Export JSON for backup or transfer; there is no cross-device synchronization. Import replaces the project and can be undone during the session.

Save to Equipment Library retains a machine's name, category, drawing kind, dimensions, rotation, and buffers. Adding its template creates an independent unlocked instance. The first saved layout supplies the comparison baseline. Undo/redo history is session-only.

## Geometry and limits

Collision checks include rotated footprints, directional buffers, angled walls, the L-shaped excluded corner, and concave keep-clear areas. Buffer-only overlaps are permitted. Area boundaries are organizational rather than physical barriers. Coverage sums physical floor footprint areas, counting overlaps twice. Buffers are staff-defined planning allowances; the tool does not determine operating clearances, code compliance, or transport paths.

## Development and verification

Use Node.js 24 (`.nvmrc`). The shared workspace needs the local API/SQLite server; serving `dist/` alone runs only the browser planner. Install the lockfile dependencies when missing. Sites hosting is configured in `.openai/hosting.json`.

```sh
npm ci
npm test
npm run build
npm run dev
```

Run automated browser checks with `npm run test:browser`. They use Playwright on desktop and mobile Chromium, a loopback-only test server and a new disposable SQLite database for each run. They never use production D1 or the normal `.gym-dev.sqlite`. An installed `/usr/bin/chromium` is used when available; otherwise run `npx playwright install chromium` first. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select another local Chromium binary. Failures retain screenshots/traces under ignored `test-results/`. The Shared layout verification workflow runs the same browser suite in CI.

Browser QA covers area edge resizing, contour controls and Hart preset, independent label rotation, storage and return, layout deletion across reload, and full-map/cropped tiled print previews with equipment legends. Existing geometry, imports, locks, buffers, and template persistence have regression coverage.

Automated browser coverage currently includes equipment/catalog edits, source-linked dimensions, metadata persistence in a separate session, duplicate/template inventory IDs, model-link geometry preservation, two-staff save conflicts, offline recovery, editor publish denial, and immutable local fixture publications. Real staff-device and hosted verification remain required by `LIVE-VERIFICATION.md`.

## Appearance

Full walls are black; half walls are gray. Fixed obstacles use a full footprint outline and diagonal hatching in both the editor and print output. The header displays the Viking artwork from BYU-Idaho's October 9, 2026 newsroom announcement, with a separate dumbbell underneath. Asset source: https://www.byui.edu/newsroom/announcements/byu-idaho-brings-back-the-viking-introducing-thor-to-a-new-generation

## GitHub hosting

A GitHub Pages workflow is prepared in `.github/workflows/pages.yml`. It tests the application and publishes only `dist/` on successful pushes to `main`. See [GitHub Pages deployment and layout transfer](GITHUB-PAGES.md) for setup and migration. Repository creation and initial Pages activation require GitHub account access; a prepared workflow alone does not mean the site is live there.

Fixed objects are excluded from keep-clear equipment warnings regardless of their lock state. They continue to participate in physical footprint, wall, and buffer conflict checks. Locked exercise equipment remains equipment and is still checked against keep-clear areas.

## Hart building plan

The February 2024 lower-level plan supplies an estimated 155 by 155 ft main footprint with an attached CrossFit room, about 180 by 155 ft overall. The lower-right exterior meets at a square corner. Only the three half walls marked by Jackson are physical: the lobby top, the lobby right, and the diagonal between the walkway and Cardio. Other area divisions are dashed boundaries, not collision walls. There is no curved exterior cutout or named spinning area.

The Hart building plan arrangement installs once. The corrected facility geometry updates existing building-plan arrangements on load and import, preserving layout identities, equipment positions and sizes, storage, templates, and custom area contours. Untouched generated Cardio and Cable contours lose the old arc; moved labels retain their positions. Earlier memory-sketch layouts remain intact. Facility setup can apply its footprint to the selected arrangement without rescaling objects. For a traced room, changing width or length scales the boundary and interior wall positions only. The printed 1,261 sq ft CrossFit annotation cross-checks the estimated scale; the resized PDF's nominal print scale is not treated as an exact measurement.

The CrossFit entry follows the larger opening below the hinged man door on the engineering drawing. The man door is treated as blocked; the main opening is approximately 10 ft wide at Y 37–47 ft on the current estimated scale. The correction updates the CrossFit wall segments and adds the short wall projections and half-wall returns visible in the drawing. Projection dimensions and locations use the same estimated scale. They render with their parent wall color and participate in footprint and buffer checks. Saved wall measurements, area contours, equipment and storage are retained.

## Shared staff layouts

The **Model checklist** link in Shared layouts opens `model-checklist.html`, the phone survey recovered from `main` and rebuilt around the shared 95-group / 155-unit catalog. Existing `hart-model-check-v2` browser progress and JSON backups remain compatible. Use Yes, No or Can’t find, enter corrections, filter by area/name/model/physical ID, and export CSV or JSON. An observation remains separate from catalog confidence and shared drafts; it never changes the published map. Checks whose reference model changed are flagged for rechecking. Browser saves stay on the current origin; use JSON backup/restore to transfer between domains or devices.

The hosted Worker adds `workspace.html` for persistent staff drafts and `map.html` for the published read-only gym map. The original browser planner remains at `index.html`. See [SHARED-LAYOUTS.md](SHARED-LAYOUTS.md) for deployment, permissions, source provenance and the remaining live verification steps. GitHub Pages serves the browser planner only; the shared API requires the hosted Worker and D1.
