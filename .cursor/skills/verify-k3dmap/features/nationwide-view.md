# Nationwide view

Nationwide view lets a user leave the opening Gwanghwamun camera, jump to a named place, flatten the view, and fit the whole country on the map.

## Sub-features

- `nationwide-open` loads the opening 3D camera at 광화문 · 종로.
- `nationwide-place` flies to a named shortcut and marks that button pressed.
- `nationwide-2d` flattens pitch and bearing from the 2D button.
- `nationwide-fit` fits the country, clears the active place, and switches the heading to 대한민국 전체.

## How to get to it (user POV)

- Open the map. The heading starts as `광화문 · 종로` and the first shortcut is pressed.
- Choose a shortcut under `바로 둘러보기`, such as `남산`.
- Choose `2D` or `3D` in the top bar.
- Choose `전국 보기`.

## Driving it with verify-k3dmap

Preconditions:

- Doctor prints `result: worth driving` for `http://127.0.0.1:8765`.
- `browser start` prints `location=광화문 · 종로` and a non-zero canvas.
- Network access to OpenFreeMap and the elevation tiles is available. Without it the map object is never created and `전국 보기` does nothing.

- **Opening state.** Read the heading. Run `node scripts/verify_k3dmap.mjs browser text --selector '#location'`. The text is `광화문 · 종로`.
- **Record the start.** Run `node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/nationwide/before.txt --feature nationwide-view --entry '초기 화면'`. `activePlace` is `광화문 · 종로` and `view3d` is `true`.
- **Fit the country.** Choose `전국 보기`. Run `node scripts/verify_k3dmap.mjs browser click --selector '#reset'`.
- **Heading.** Run `node scripts/verify_k3dmap.mjs browser wait --selector '#location' --text '대한민국 전체'`. The heading is `대한민국 전체` before the camera animation finishes.
- **Camera finished.** Run `node scripts/verify_k3dmap.mjs browser wait --selector '#pitch-value' --text '0°'` and `node scripts/verify_k3dmap.mjs browser wait --selector '#view2d[aria-pressed="true"]'`. Pitch is `0°` and the 2D button is pressed.
- **Place cleared.** Run `node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/nationwide/after.txt --feature nationwide-view --entry '전국 보기'`. `activePlace` is empty.
- **Proof.** Run `node scripts/verify_k3dmap.mjs browser screenshot --path /tmp/k3dmap-verify-evidence/nationwide/after.png`. The shot shows the Korea map, the heading `대한민국 전체`, and the `2D` button pressed.
- **Place shortcut.** Reload with a new `browser start` before this step, because the fit above left the nationwide camera. Run `node scripts/verify_k3dmap.mjs browser click --selector '#places button' --has-text '남산'` and `node scripts/verify_k3dmap.mjs browser wait --selector '#location' --text '남산'`. The heading is `남산` and that shortcut is the active place.

## Gotchas

- The heading changes as soon as the button is clicked. Pitch reaches `0°` only when the 1500ms fit finishes. Wait for the pitch, not a fixed sleep.
- `남산` is an exact `<strong>` label. A substring match would also hit `북한산`.
- Place buttons are created by script and have no ids. Use `#places button` plus the exact name.
- If `#status` stays on a load error, stop. Clicking `전국 보기` cannot prove a map that never started.
- `smoke` runs only the fit journey, not the Namsan shortcut.
