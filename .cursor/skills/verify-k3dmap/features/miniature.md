# Miniature

Miniature switches the map between the standard style and the miniature style, and can fly to the Namsan miniature example.

## Sub-features

- `miniature-default` opens in miniature mode.
- `miniature-standard` switches to the standard map.
- `miniature-namsan` flies to 남산 in miniature mode.

## How to get to it (user POV)

- On load, the `미니어처` button is pressed and the note `미니어처 · 확대하면 지붕·창문 표시` is visible.
- Choose `기본 지도`.
- Choose `남산 미니어처 둘러보기`.

## Driving it with verify-k3dmap

Preconditions:

- The baseline map is ready at `광화문 · 종로`.
- The served `cartography.json` has `appearance.mode` of `miniature`. An older file without `appearance` opens in standard mode instead. If doctor shows `mode standard`, this journey's first assertion does not apply; report that precondition instead of forcing the button.

- **Default mode.** Run `node scripts/verify_k3dmap.mjs browser wait --selector '[data-mode="miniature"][aria-pressed="true"]'`. The miniature button is pressed.
- **Standard map.** Choose `기본 지도`. Run `node scripts/verify_k3dmap.mjs browser click --selector '[data-mode="standard"]'` and `node scripts/verify_k3dmap.mjs browser wait --selector '[data-mode="standard"][aria-pressed="true"]'`. The miniature note is hidden.
- **Namsan tour.** Choose `남산 미니어처 둘러보기`. Run `node scripts/verify_k3dmap.mjs browser click --selector '#miniature-namsan'` and `node scripts/verify_k3dmap.mjs browser wait --selector '#location' --text '남산 · 미니어처'`. The heading is `남산 · 미니어처` and the miniature button is pressed again.
- **Proof.** Run `node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/miniature/namsan.txt --feature miniature --entry '남산 미니어처 둘러보기'` and `node scripts/verify_k3dmap.mjs browser screenshot --path /tmp/k3dmap-verify-evidence/miniature/namsan.png`. The snapshot has `location: 남산 · 미니어처` and `mode: miniature`. The screenshot shows that heading.

## Gotchas

- The nationwide fit leaves the heading as `대한민국 전체`. Run this journey from `browser start`, not after `전국 보기`, unless the recipe says to reload.
- The miniature note stays visible during `전국 보기` when the mode is still miniature. A nationwide screenshot that still shows the note is expected.
- Mode buttons share no id. Use `[data-mode="standard"]` and `[data-mode="miniature"]`.
- The Namsan flight takes about 1300ms. The heading text changes immediately; the camera finishes later. The heading is the assertion.
