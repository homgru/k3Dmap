# Onbid auctions

Onbid auctions shows the public-sale layer, a count of visible items, and filters for type, discount, and failed bids.

## Sub-features

- `auctions-status` shows whether the snapshot loaded.
- `auctions-filter` narrows the visible count by discount.
- `auctions-hide` hides the filter panel and the layer.

## How to get to it (user POV)

- The `온비드 공매` checkbox in `지도 설정` is on when the page opens.
- Read the count next to `온비드 공매`, initially updating from `0건 표시`.
- Choose `20% 이상` under `할인율`.
- Clear the `온비드 공매` checkbox.

## Driving it with verify-k3dmap

Preconditions:

- The baseline map is ready.
- This journey needs the remote snapshot. The page requests `https://raw.githubusercontent.com/homgru/k3Dmap/main/dist/onbid-auctions.geojson`, not `dist/onbid-auctions.geojson` on the local server.
- If that request fails, `#auction-data-state` becomes `데이터를 준비하지 못했습니다`. Stop and report that failure. Do not retarget the page at the local file to force a pass.

- **Wait for the snapshot.** Run `node scripts/verify_k3dmap.mjs browser wait --selector '#auction-data-state' --starts-with '갱신'`. A loaded snapshot starts with `갱신 `. The date after that prefix changes every fetch.
- **Read the count.** Run `node scripts/verify_k3dmap.mjs browser text --selector '#auction-count'`. The text matches a number followed by `건 표시`, and the number is greater than 0.
- **Filter.** Choose `20% 이상`. Run `node scripts/verify_k3dmap.mjs browser fill --selector '#auction-discount' --value 20` and `node scripts/verify_k3dmap.mjs browser text --selector '#auction-count'`. The new count is a `건 표시` value less than or equal to the previous count.
- **Hide.** Run `node scripts/verify_k3dmap.mjs browser click --selector '#auctions'` and `node scripts/verify_k3dmap.mjs browser wait --selector '#auction-filters[hidden]'`. The filter block is hidden.
- **Proof.** Run `node scripts/verify_k3dmap.mjs browser snapshot --path /tmp/k3dmap-verify-evidence/auctions/filtered.txt --feature auctions --entry '할인율 20% 이상'`. Capture this snapshot before hiding the layer if the count is the claim. The status line and both counts belong in `actions.log`.

## Gotchas

- A green local `check` of `dist/onbid-auctions.geojson` does not prove this panel. The panel reads GitHub's `main` copy.
- The count starts at `0건 표시` before the fetch returns. Wait for the `갱신` status before asserting a count.
- Discount options are `0`, `20`, `30`, and `40`. The filter keeps items whose discount is at least the selected value.
- Hiding the layer does not clear the fetched features. Show it again by clicking `#auctions` before another filter assertion.
- Do not run `scripts/update_onbid_auctions.py` during this journey. That script contacts Onbid and Nominatim.
