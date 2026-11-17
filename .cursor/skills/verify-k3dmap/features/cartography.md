# Cartography

Cartography lets a user change how the map is drawn, restore the file defaults, and download the current settings as `cartography.json`.

## Sub-features

- `cartography-open` expands the presentation panel.
- `cartography-edit` applies a terrain exaggeration change on the current map.
- `cartography-reset` restores the values loaded from `dist/cartography.json`.
- `cartography-export` downloads the current settings.

## How to get to it (user POV)

- Choose `지도 표현 설정` in the left sidebar.
- Move `높이 배율` under `산·언덕`.
- Choose `기본값 복원`.
- Choose `설정 내려받기`.

## Driving it with verify-k3dmap

Preconditions:

- The baseline map is ready and `#location` is `광화문 · 종로`.
- Doctor prints `result: worth driving`.
- The shipped exaggeration is `1`. If a change under test edited that default, compare against the file that was actually served.

- **Open the panel.** Choose `지도 표현 설정`. Run `node scripts/verify_k3dmap.mjs browser click --selector 'details.cartography-panel > summary'`. The panel is open.
- **Change height.** Set `높이 배율` to 1.5. Run `node scripts/verify_k3dmap.mjs browser fill --selector '[data-setting="terrain.exaggeration"]' --value 1.5`. The control's value is `1.5`.
- **Confirm the control.** Run `node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/cartography/edited.txt --feature cartography --entry '높이 배율'`. Then read the value with `node scripts/verify_k3dmap.mjs browser text --selector 'label.carto-field:has([data-setting="terrain.exaggeration"]) output'`. The output reads `1.5`.
- **Restore defaults.** Choose `기본값 복원`. Run `node scripts/verify_k3dmap.mjs browser click --selector '#cartography-reset'` and `node scripts/verify_k3dmap.mjs browser text --selector 'label.carto-field:has([data-setting="terrain.exaggeration"]) output'`. The output reads `1` when the served file still has exaggeration `1`.
- **Download.** Choose `설정 내려받기`. Run `node scripts/verify_k3dmap.mjs browser click --selector '#cartography-export'` and `node scripts/verify_k3dmap.mjs browser wait-file --name cartography.json`. The file `/tmp/k3dmap-verify-evidence/downloads/cartography.json` is non-empty JSON with `"version": 1`.
- **Proof.** The edited snapshot, the restored `1` reading, and the downloaded file are the proof. A screenshot of the open panel is optional and does not replace the downloaded file.

## Gotchas

- The download button sits inside the closed `<details>`. Open the summary first or the click reports `not visible`.
- Refreshing the page reloads `dist/cartography.json`. The panel does not write the repo file.
- `기본값 복원` restores the values from page load, not whatever is on disk now if the server was started before a file edit. Restart the verification server after changing the JSON.
- The range control listens for `input`. The helper's `fill` command dispatches it. Typing the value into the DOM without that event does not update the map.
