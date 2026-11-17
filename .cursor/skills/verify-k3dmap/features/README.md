# k3Dmap verification map

This directory is the maintained source for verifying the user-facing behavior of k3Dmap. Read this index, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `node scripts/verify_k3dmap.mjs launch` so the app is at `http://127.0.0.1:8765`.
- Run `node scripts/verify_k3dmap.mjs doctor` and require `result: worth driving`.
- Run `node scripts/verify_k3dmap.mjs browser start` and require location `광화문 · 종로` before any click.
- The shipped `dist/cartography.json` and `dist/onbid-auctions.geojson` are the fixtures. There is no separate seed step.
- Never drive an instance that was not started by this verification run. Do not reuse port 8000.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Use the selectors in the feature file. Prefer ids and `data-setting` / `data-mode`.
- `--has-text` is an exact label match, not a substring.
- Run every browser action through `node scripts/verify_k3dmap.mjs browser ...`.
- Keep proof files under `/tmp/k3dmap-verify-evidence/`. Cleanup removes the server and Chrome only.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof is a snapshot text file plus a screenshot that shows the app title and the changed control.
- Record the feature id and the entry point on the snapshot.
- If a journey cannot be reached, report the command that failed and the unmet precondition. Do not mark it verified through a different control.

## Features

- [Nationwide view](./nationwide-view.md) covers the opening camera, place shortcuts, 2D/3D, and 전국 보기.
- [Cartography](./cartography.md) covers the presentation panel, reset, and settings download.
- [Onbid auctions](./auctions.md) covers the auction toggle, filters, and remote snapshot status.
- [Miniature](./miniature.md) covers the mode switch and the Namsan miniature tour.
- [Map layers](./map-layers.md) covers terrain, buildings, labels, and landcover toggles.
