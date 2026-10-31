# Hart Fitness Center Layout Studio

A static, dependency-free floor planner for the BYU-Idaho Hart Fitness Center.

**Live planner:** https://froggreen981.github.io/hart-fitness-layout-studio/

**Source:** https://github.com/Froggreen981/hart-fitness-layout-studio

Moving from the original site? Export JSON there, then Import on the live planner to transfer your saved layouts, templates, and storage inventory.

## Editing

- Set rectangular or L-shaped room dimensions in feet. Edit full-wall and half-wall endpoints and thickness under Walls & half walls. Changing room size does not rescale existing objects.
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

Serve `dist/` over HTTP. No installation or build is required. Hosting is configured through `.github/workflows/pages.yml`.

```sh
node --check dist/app.js
node --test test-model.mjs test-sketch.mjs test-areas.mjs test-editor.mjs test-storage.mjs
```

Browser QA covers area edge resizing, contour controls and Hart preset, independent label rotation, storage and return, layout deletion across reload, and full-map/cropped tiled print previews with equipment legends. Existing geometry, imports, locks, buffers, and template persistence have regression coverage.

## Appearance

Full walls are black; half walls are grey. Fixed obstacles use a full footprint outline and diagonal hatching in both the editor and print output. The header displays the Viking artwork from BYU-Idaho's October 9, 2026 newsroom announcement, with a separate dumbbell underneath. Asset source: https://www.byui.edu/newsroom/announcements/byu-idaho-brings-back-the-viking-introducing-thor-to-a-new-generation

## GitHub hosting

GitHub Pages is active through `.github/workflows/pages.yml`. It tests the application and publishes only `dist/` on successful pushes to `main`. See [GitHub Pages deployment and layout transfer](GITHUB-PAGES.md) for migration instructions. The original site remains available for exporting browser-saved projects. No user layout exports or browser storage are included in this repository.

Fixed objects are excluded from keep-clear equipment warnings regardless of their lock state. They continue to participate in physical footprint, wall, and buffer conflict checks. Locked exercise equipment remains equipment and is still checked against keep-clear areas.
