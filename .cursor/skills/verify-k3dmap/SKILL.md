---
name: verify-k3dmap
description: Drive the k3Dmap Korean 3D map in a browser the way a user would, and prove the nationwide view, cartography, onbid auctions, and miniature controls. Use before declaring map, UI, or snapshot work done, or when a change needs a smoke run.
---

# Verify k3Dmap

k3Dmap is a static web app in `dist/`. A user runs `python3 -m http.server` and uses the map in a browser. There is no build, no account, and no local database. Map style and terrain tiles come from the network. The helper is `scripts/verify_k3dmap.mjs` (Node 22+, global `WebSocket`, `python3`, `google-chrome`, `lsof`).

Do not drive a server you did not start. The documented user port is 8000. Verification uses 8765 so it does not attach to that session. Two runs need different `K3DMAP_PORT`, `K3DMAP_DEBUG_PORT`, `K3DMAP_STATE_DIR`, and `K3DMAP_EVIDENCE_DIR`.

## Launch

From the repo root:

```sh
node scripts/verify_k3dmap.mjs launch
```

This starts `python3 -m http.server 8765 --directory dist --bind 127.0.0.1`, records the pid in `/tmp/k3dmap-verify/state/http.json`, and waits until `http://127.0.0.1:8765/` serves `<title>대한민국 3D — Spatial Atlas</title>`.

The page is usable only after the browser loads the OpenFreeMap style and the map canvas. `browser start` is the usable-ready check. It is ready when all of these are true:

- `#map canvas` has a non-zero size and a WebGL context can be created
- `#cartography-fields` has at least 5 groups
- `#places` has 7 buttons
- `#location` reads `광화문 · 종로`
- `#status` is empty, or exactly `건물을 보려면 지도를 더 확대해 주세요.`

These status strings mean the map did not start: `3D 지도를 시작하지 못했습니다`, `지형 고도 데이터를 불러오지 못했습니다`, `지도 일부를 불러오지 못했습니다`, `미니어처 세부 모델을 불러오지 못했습니다`.

Overrides: `K3DMAP_PORT`, `K3DMAP_DEBUG_PORT`, `K3DMAP_STATE_DIR`, `K3DMAP_EVIDENCE_DIR`.

## Doctor

```sh
node scripts/verify_k3dmap.mjs doctor
```

Read-only. It passes only when the recorded pid is alive, that pid owns the listen socket, the origin still serves the Spatial Atlas title, `cartography.json` validates, and `app.js` contains `function start`. A healthy run prints `result: worth driving`. Anything else is not worth driving.

## Drive

Start Chrome only after doctor passes:

```sh
node scripts/verify_k3dmap.mjs browser start
```

Chrome is headless with SwiftShader WebGL, `--no-sandbox`, and a profile under the state dir. The helper clicks with real mouse events at the element's box. `--has-text` matches the `<strong>` label when the button has one, otherwise the trimmed button text. It does not use a substring, so `남산` does not hit `북한산`.

```sh
node scripts/verify_k3dmap.mjs browser text --selector '#location'
node scripts/verify_k3dmap.mjs browser click --selector '#reset'
node scripts/verify_k3dmap.mjs browser click --selector '#places button' --has-text '남산'
node scripts/verify_k3dmap.mjs browser fill --selector '[data-setting="terrain.exaggeration"]' --value 1.5
node scripts/verify_k3dmap.mjs browser wait --selector '#location' --text '대한민국 전체'
node scripts/verify_k3dmap.mjs browser wait --selector '#auction-data-state' --starts-with '갱신'
node scripts/verify_k3dmap.mjs browser wait --selector '#view2d[aria-pressed="true"]'
node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/nationwide/after.txt --feature nationwide-view --entry '전국 보기'
node scripts/verify_k3dmap.mjs browser screenshot --path /tmp/k3dmap-verify-evidence/nationwide/after.png
node scripts/verify_k3dmap.mjs browser wait-file --name cartography.json
```

`fill` sets the control and dispatches `input` and `change`. Downloads land in `/tmp/k3dmap-verify-evidence/downloads/`.

The feature map in `features/` is the source for which journey to run. Prove the journey you changed. `smoke` always proves `nationwide-view` and does not cover the others.

## Evidence

Proof stays in `/tmp/k3dmap-verify-evidence/` (or `K3DMAP_EVIDENCE_DIR`). Cleanup must not delete it.

- `actions.log` records each launch, click, and observed text
- `nationwide/before.txt` and `nationwide/after.txt` are the UI state before and after `전국 보기`
- `nationwide/after.png` is the viewport after the camera finishes

A passing nationwide proof shows the action (`click #reset`) and the result together: `location: 대한민국 전체`, `pitch: 0°`, `view2d: true`, an empty `activePlace`, and a screenshot of the Korea map with the heading `대한민국 전체` visible. Do not treat `canvas.toDataURL()` as proof. Do not treat a status string alone as proof.

The page talks to `https://tiles.openfreemap.org` and `https://s3.amazonaws.com/elevation-tiles-prod`. That network is part of the real path. The onbid layer separately fetches `https://raw.githubusercontent.com/homgru/k3Dmap/main/dist/onbid-auctions.geojson`, not the local file. A local GeoJSON edit is not proven by the onbid panel.

## Cleanup

```sh
node scripts/verify_k3dmap.mjs cleanup
```

Sends `SIGTERM` to the recorded Chrome and Python pids and their children, then removes `/tmp/k3dmap-verify/state`. It does not kill by process name and does not remove evidence. After cleanup, `nationwide/after.png` and `actions.log` must still be there.

## Helpers

`scripts/verify_k3dmap.mjs` is the only helper. Run `node scripts/verify_k3dmap.mjs` with no args to print the command list.

Quick checks, in order:

```sh
node scripts/verify_k3dmap.mjs check
node scripts/verify_k3dmap.mjs smoke
```

`check` is offline: `node --check` on the authored `dist/*.js` modules, `py_compile` of `scripts/update_onbid_auctions.py`, cartography ranges copied from `Cartography.validate`, and a Point-feature check of `dist/onbid-auctions.geojson`. This repo has no ESLint and no pytest. Do not run `scripts/update_onbid_auctions.py` as a smoke test. It calls the Onbid API and Nominatim and needs `ONBID_SERVICE_KEY`.

`smoke` runs `check`, launch, doctor, the nationwide journey, writes the evidence files, runs cleanup, then checks that the screenshot and snapshot survived. If it fails, run cleanup again before retrying so the port is not left behind.

## Feature map

Read `features/README.md`, then the file for the behavior you changed.

Keep this map honest with `/maintain-verification-skill` when the UI or the data path changes.
