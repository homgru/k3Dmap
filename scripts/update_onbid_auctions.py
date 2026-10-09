#!/usr/bin/env python3
"""Build a cached GeoJSON snapshot from the official Onbid API."""
import datetime as dt
import argparse
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
REQUEST_TIMEOUT = 60
REQUEST_ATTEMPTS = 3


def get_json(url, headers=None):
    request = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    for attempt in range(1, REQUEST_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            # Retry transient throttling/server failures, but fail fast on invalid
            # API parameters or credentials. Never print the request URL because
            # it contains the service key.
            if error.code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f"데이터 API 요청 실패 (HTTP {error.code})") from None
            if attempt == REQUEST_ATTEMPTS:
                raise RuntimeError(
                    f"데이터 API 일시 오류가 {REQUEST_ATTEMPTS}회 반복됨 (HTTP {error.code})"
                ) from None
            print(
                f"데이터 API 일시 오류 (HTTP {error.code}); "
                f"{attempt}/{REQUEST_ATTEMPTS - 1}회 재시도 대기",
                file=sys.stderr,
            )
            error.close()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
            if attempt == REQUEST_ATTEMPTS:
                raise RuntimeError(
                    f"데이터 API 연결 실패: {type(error).__name__}, "
                    f"{REQUEST_ATTEMPTS}회 시도 후 중단"
                ) from None
            print(
                f"데이터 API 연결이 지연됨 ({type(error).__name__}); "
                f"{attempt}/{REQUEST_ATTEMPTS - 1}회 재시도 대기",
                file=sys.stderr,
            )
        time.sleep(2 ** attempt)


def items_from(payload):
    body = payload.get("response", {}).get("body", payload.get("body", {}))
    items = body.get("items", {}).get("item", [])
    if isinstance(items, dict):
        return [items]
    return items or []


def fetch_onbid(key, region=None):
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
        if region:
            params["lctnSdnm"] = region
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


def parcel_address(item):
    """Build a clean lot-number address from Onbid's PNU and locality fields."""
    pnu = str(item.get("ltnoPnu") or "").strip()
    if not re.fullmatch(r"\d{19}", pnu):
        return address_of(item), "address"
    main_number = int(pnu[11:15])
    sub_number = int(pnu[15:19])
    if not main_number:
        return address_of(item), "address"
    lot_number = ("산" if pnu[10] == "1" else "") + str(main_number)
    if sub_number:
        lot_number += f"-{sub_number}"
    locality = " ".join(str(item.get(field) or "").strip() for field in (
        "lctnSdnm", "lctnSggnm", "lctnEmdNm"
    )).strip()
    return (f"{locality} {lot_number}".strip() if locality else address_of(item)), "parcel"


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
        geocode_address, geocode_precision = parcel_address(item)
        item = dict(
            item, _address=address, _geocodeAddress=geocode_address,
            _geocodePrecision=geocode_precision, _start=start, _end=end,
        )
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


def geocode_query(query_text, precision, cache, request_budget):
    cache_key = "__query__:" + query_text
    cached = cache.get(cache_key)
    if isinstance(cached, dict) and isinstance(cached.get("coordinates"), list):
        return cached, 0
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
    if isinstance(cached, dict) and cached.get("retryAfter", "") > today:
        return None, 0
    if request_budget <= 0:
        return None, 0
    query = urllib.parse.urlencode({
        "q": query_text + ", 대한민국",
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": "kr",
    })
    try:
        results = get_json(NOMINATIM + "?" + query, {"Accept-Language": "ko"})
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
        print(f"지오코딩 요청 실패(건너뜀): {type(error).__name__}", file=sys.stderr)
        return None, 1
    time.sleep(1.05)
    if results:
        result = {
            "coordinates": [float(results[0]["lon"]), float(results[0]["lat"])],
            "precision": precision,
        }
        cache[cache_key] = result
        return result, 1
    cache[cache_key] = {
        "retryAfter": (dt.date.fromisoformat(today) + dt.timedelta(days=30)).isoformat()
    }
    return None, 1


def geocode(address, cache, request_budget, precision="address"):
    full = re.sub(r"\s+", " ", address).strip()
    simplified = re.sub(r"\s+\d+(?:-\d+)?\s*(?:동|층|호)\b.*$", "", full)
    simplified = re.sub(
        r"\s+(?:아파트|오피스텔|근린생활시설|상가|업무시설|토지|건물).*$", "", simplified
    ).strip()
    queries = []
    for query_text in (simplified, full):
        if query_text and query_text not in queries:
            queries.append(query_text)
    requests_made = 0
    for query_text in queries:
        result, used = geocode_query(query_text, precision, cache, request_budget - requests_made)
        requests_made += used
        if result:
            return result, requests_made
    return None, requests_made


def geocode_area(item, cache, request_budget):
    district = " ".join(str(item.get(field) or "").strip() for field in (
        "lctnSdnm", "lctnSggnm"
    )).strip()
    neighborhood = " ".join(str(item.get(field) or "").strip() for field in (
        "lctnSdnm", "lctnSggnm", "lctnEmdNm"
    )).strip()
    requests_made = 0
    for query_text, precision in ((neighborhood, "neighborhood"), (district, "district")):
        if not query_text:
            continue
        result, used = geocode_query(
            query_text, precision, cache, request_budget - requests_made
        )
        requests_made += used
        if result:
            return result, requests_made
    return None, requests_made


def main(region=None):
    key = os.environ.get("ONBID_SERVICE_KEY", "").strip()
    if not key:
        raise RuntimeError("GitHub Actions Secret ONBID_SERVICE_KEY가 설정되지 않았습니다.")
    raw_items = fetch_onbid(key, region)
    records = normalized_items(raw_items)
    print(
        f"온비드 조회 지역: {region or '전체'}, API 응답 {len(raw_items)}건, "
        f"진행 상태·입찰 일정 필터 통과 {len(records)}건",
        flush=True,
    )
    if not records:
        raise RuntimeError(
            f"온비드 API 응답 {len(raw_items)}건 중 표시 가능한 물건이 0건입니다. "
            "기존 지도 데이터를 유지합니다."
        )
    cache = load_cache()
    features = []
    new_geocodes = 0
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
    for item in records:
        address = item["_address"]
        cached = cache.get(address)
        previous_approximation = None
        if isinstance(cached, list):
            coords = cached
            precision = "address"
        elif isinstance(cached, dict) and isinstance(cached.get("coordinates"), list):
            cached_precision = cached.get("precision", "address")
            if cached_precision in ("address", "parcel"):
                coords = cached["coordinates"]
                precision = cached_precision
            else:
                coords = None
                precision = "unknown"
                previous_approximation = cached
        elif isinstance(cached, dict) and cached.get("retryAfter", "") > today:
            coords = []
            precision = "unknown"
        else:
            coords = None
            precision = "unknown"
        if not coords:
            result = None
            result, used = geocode(
                item["_geocodeAddress"], cache, MAX_NEW_GEOCODES - new_geocodes,
                item["_geocodePrecision"],
            )
            new_geocodes += used
            if not result:
                result, used = geocode_area(item, cache, MAX_NEW_GEOCODES - new_geocodes)
                new_geocodes += used
            if result:
                cache[address] = result
                coords = result["coordinates"]
                precision = result["precision"]
            elif previous_approximation:
                coords = previous_approximation["coordinates"]
                precision = previous_approximation.get("precision", "district")
            else:
                cache[address] = {
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
                "locationPrecision": precision,
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
    precise = sum(1 for feature in features if feature["properties"]["locationPrecision"] in ("address", "parcel"))
    neighborhood = sum(1 for feature in features if feature["properties"]["locationPrecision"] == "neighborhood")
    district = sum(1 for feature in features if feature["properties"]["locationPrecision"] == "district")
    print(
        f"온비드 조회 물건 {len(records)}개, 좌표 포함 {len(features)}개 "
        f"(주소 좌표 {precise}개, 읍면동 근사 {neighborhood}개, 구 근사 {district}개); "
        f"신규 지오코딩 요청 {new_geocodes}건 처리"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build an Onbid auction GeoJSON snapshot")
    parser.add_argument("--region", help="Filter by province/city name, for example 서울특별시")
    main(parser.parse_args().region)
