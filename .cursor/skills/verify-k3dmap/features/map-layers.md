# Map layers

Map layers lets a user show or hide terrain, landcover, buildings, and place labels from the left sidebar.

## Sub-features

- `layers-terrain` toggles 입체 지형.
- `layers-landcover` toggles 농경지 패턴·입체 나무.
- `layers-buildings` toggles 입체 건물.
- `layers-labels` toggles 지명 표시.

## How to get to it (user POV)

- In `지도 설정`, use the checkboxes `입체 지형`, `농경지 패턴·입체 나무`, `입체 건물`, and `지명 표시`.
- All four start checked.

## Driving it with verify-k3dmap

Preconditions:

- The baseline map is ready and the cartography fields have been mounted.
- Doctor prints `result: worth driving`.

- **Terrain off.** Run `node scripts/verify_k3dmap.mjs browser click --selector '#terrain'` and `node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/layers/terrain-off.txt --feature map-layers --entry '입체 지형'`. `terrain` is `false`.
- **Terrain on.** Run the same click again and snapshot `/tmp/k3dmap-verify-evidence/layers/terrain-on.txt`. `terrain` is `true`.
- **Buildings off.** Run `node scripts/verify_k3dmap.mjs browser click --selector '#buildings'` and snapshot `/tmp/k3dmap-verify-evidence/layers/buildings-off.txt`. `buildings` is `false`.
- **Labels off.** Run `node scripts/verify_k3dmap.mjs browser click --selector '#labels'`. The snapshot's `labels` value is `false`.
- **Landcover off.** Run `node scripts/verify_k3dmap.mjs browser click --selector '#landcover'`. The snapshot's `landcover` value is `false`.
- **Proof.** Each snapshot pairs the click in `actions.log` with the checkbox state. Also take `node scripts/verify_k3dmap.mjs browser screenshot --path /tmp/k3dmap-verify-evidence/layers/buildings-off.png` while buildings are off, from the opening zoom, so the map canvas is part of the proof.

## Gotchas

- The checkbox state is the reliable assertion. A nationwide zoom makes building extrusion hard to see, so take the buildings screenshot at the opening 광화문 zoom.
- Turning terrain off does not change `#location`. Do not use the heading as proof for this feature.
- `농경지 패턴·입체 나무` is one checkbox, `#landcover`, not two.
- Cartography reset can turn terrain and buildings back on from the file defaults. Run this journey before a cartography reset, or start a fresh browser page.
