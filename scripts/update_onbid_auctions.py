#!/usr/bin/env python3
"""Build a cached GeoJSON snapshot from the official Onbid API."""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist/onbid-auctions.geojson"
CACHE = ROOT / "data/onbid-geocode-cache.json"
API = "https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList2"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
PAGE_SIZE = 100
MAX_PAGES = 40  # Daily job stays well below the API's default 1,000-call quota.
MAX_NEW_GEOCODES = 300  # Nominatim fair-use limit: at most one request per second.
UA = "k3Dmap-onbid-batch/1.0 (https://github.com/homgru/k3Dmap)"


def get_json(url, headers=None):
    request = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(request, timeout=35) as response:
        return json.loads(response.read().decode("utf-8"))


def items_from(payload):
    body = payload.get("response", {}).get("body", payload.get("body", {}))
    items = body.get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]
    return items or []


def fetch_onbid(key):
    found = []
    for page in range(1, MAX_PAGES + 1):
        params = {
            "serviceKey": key,
            "pageNo": page,
            "numOfRows": PAGE_SIZE,
            "resultType": "json",
            "prptDivCd": "0007,0010,0005,0002,0003,0006,0008,0011,0013",
            "bidDivCd": "0001",
            "pvctTrgtYn": "N",
            "dspsMthodCd": "0001",
        }
        payload = get_json(API + "?" + urllib.parse.urlencode(params))
        error = payload.get("OpenAPI_ServiceResponse", {}).get("cmmMsgHeader")
        if error:
            raise RuntimeError(f"온비드 API 오류 {error.get('returnReasonCode')}: {error.get('errMsg')}")
        response = payload.get("response", payload)
        header = response.get("header", {})
        if str(header.get("resultCode", "00")) not in ("00", "03"):
            raise RuntimeError(f"온비드 API 오류 {header.get('resultCode')}: {header.get('resultMsg')}")
        page_items = items_from(payload)
        found.extend(page_items)
        total = int(response.get("body", {}).get("totalCount", 0) or 0)
        if not page_items or page * PAGE_SIZE >= total:
            break
        time.sleep(0.15)
    return found


def address_of(item):
    value = str(item.get("onbidCltrNm") or "").strip()
    value = re.sub(r"^\[[^]]+\]\s*", "", value)
    return re.sub(r"\s+", " ", value)


def valid_bid_date(value):
    value = str(value or "")
    if not re.fullmatch(r"\d{12}", value) or value.startswith("2999"):
        return None
    try:
        return dt.datetime.strptime(value, "%Y%m%d%H%M").replace(tzinfo=dt.timezone(dt.timedelta(hours=9)))
    except ValueError:
        return None


def normalized_items(items):
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=9)))
    grouped = {}
    for item in items:
        if str(item.get("pbctStatCd", "0001")) not in ("0001", "0002", "0009"):
            continue
        end = valid_bid_date(item.get("cltrBidEndDt"))
        start = valid_bid_date(item.get("cltrBidBgngDt"))
        if not end or end < now - dt.timedelta(days=1) or end > now + dt.timedelta(days=180):
            continue
        key = str(item.get("cltrMngNo") or "").strip()
        address = address_of(item)
        if not key or not address:
            continue
        item = dict(item, _address=address, _start=start, _end=end)
        current = grouped.get(key)
        # Prefer an ongoing bid, then the earliest upcoming round for this asset.
        priority = (0 if str(item.get("pbctStatCd")) == "0002" else 1, start or end)
        current_priority = (
            0 if current and str(current.get("pbctStatCd")) == "0002" else 1,
            (current.get("_start") or current["_end"]) if current else end,
        )
        if current is None or priority < current_priority:
            grouped[key] = item
    return list(grouped.values())


def load_cache():
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def geocode(address, cache):
    query = urllib.parse.urlencode({"q": address + ", 대한민국", "format": "jsonv2", "limit": 1, "countrycodes": "kr"})
    try:
        results = get_json(NOMINATIM + "?" + query, {"Accept-Language": "ko"})
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print(f"지오코딩 실패(건너뜀): {error}", file=sys.stderr)
        time.sleep(1.05)
        return None
    time.sleep(1.05)
    if not results:
        return None
    return [float(results[0]["lon"]), float(results[0]["lat"])]


def main():
    key = os.environ.get("ONBID_SERVICE_KEY", "").strip()
    if not key:
        raise RuntimeError("GitHub Actions Secret ONBID_SERVICE_KEY가 설정되지 않았습니다.")
    records = normalized_items(fetch_onbid(key))
    if not records:
        raise RuntimeError("온비드 API에서 표시 가능한 물건이 없어 기존 지도 데이터를 유지합니다.")
    cache = load_cache()
    features = []
    new_geocodes = 0
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
    for item in records:
        address = item["_address"]
        cached = cache.get(address)
        if isinstance(cached, list):
            coords = cached
        elif isinstance(cached, dict) and cached.get("retryAfter", "") > today:
            coords = []
        else:
            coords = None
        if coords is None and new_geocodes < MAX_NEW_GEOCODES:
            coords = geocode(address, cache)
            new_geocodes += 1
            if coords is not None:
                cache[address] = coords or {
                    "retryAfter": (dt.date.fromisoformat(today) + dt.timedelta(days=30)).isoformat()
                }
        if not coords:
            continue
        appraisal = int(item.get("apslEvlAmt") or 0)
        minimum_text = str(item.get("lowstBidPrcIndctCont") or "").replace(",", "").strip()
        if not appraisal or not minimum_text.isdigit():
            continue
        minimum = int(minimum_text)
        ratio = round(minimum / appraisal * 100) if appraisal else None
        discount = max(0, min(100, round(100 - ratio))) if ratio is not None else 0
        start = item.get("_start")
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coords},
            "properties": {
                "id": str(item.get("cltrMngNo")),
                "type": item.get("cltrUsgSclsCtgrNm") or item.get("cltrUsgMclsCtgrNm") or item.get("cltrUsgLclsCtgrNm") or "부동산",
                "address": item["_address"],
                "appraisalPrice": appraisal,
                "minimumPrice": minimum,
                "priceRatio": ratio if ratio is not None else "비공개",
                "discountRate": discount,
                "failedCount": int(item.get("usbdNft") or 0),
                "bidStart": item.get("cltrBidBgngDt") if start else "",
                "bidEnd": item.get("cltrBidEndDt") if item.get("_end") else "",
                "status": item.get("pbctStatNm") or "입찰 예정",
                "area": f"토지 {item.get('landSqms')}m² · 건물 {item.get('bldSqms')}m²" if item.get("landSqms") or item.get("bldSqms") else "",
                "sourceUrl": "https://www.onbid.co.kr/",
                "updatedAt": today,
            },
        })
    if not features:
        raise RuntimeError("좌표가 포함된 공매 물건이 없어 기존 지도 데이터를 유지합니다.")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({"type": "FeatureCollection", "metadata": {"source": "한국자산관리공사 온비드", "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "itemCount": len(features), "apiRowsRead": len(records)}, "features": features}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"온비드 조회 물건 {len(records)}개, 좌표 포함 {len(features)}개; 신규 주소좌표 {new_geocodes}개 처리")


if __name__ == "__main__":
    main()
