# k3Dmap
한국 3D지도

공개 지도·고도 데이터로 대한민국의 건물, 산과 언덕, 농경지, 숲을 탐색하는 정적 웹 앱입니다.

## 실행

Python 3 설치 후 다음 명령을 실행합니다.

```sh
git clone https://github.com/homgru/k3Dmap.git
cd k3Dmap
python3 -m http.server 8000 --directory dist
```

브라우저에서 http://localhost:8000 을 엽니다. ES 모듈을 사용하므로 HTML을 파일로 직접 열지 말고 HTTP 서버를 사용하세요. WebGL 지원 및 인터넷 연결이 필요합니다. npm 설치나 빌드는 필요하지 않습니다.

## 기능

- 대한민국 전역 이동 및 전국 보기, 서울 주요 지역 바로가기
- 지도 회전·확대, 2D/3D 전환, 시야 기울기 조절
- 건물 높이에 따른 입체 표시와 건물 정보 팝업
- 지형 DEM 및 음영, 지형 켜기/끄기, 높이 배율 조절(기본 1배)
- 농경지 고랑 패턴과 지도상 영역 경계
- 숲에 단순한 줄기와 원뿔·둥근 수관의 입체 나무 표시
- 카르토그래피 설정 패널과 JSON 기본값 관리, 설정 파일 내려받기
- 샘플 경매 물건 클러스터, 가격·할인율 라벨, 상세 팝업과 종류·할인율·유찰 필터

## 성능과 나무 배치

MapLibre가 화면에 필요한 지도·고도 타일을 요청하고 캐시합니다. 전국의 상세 데이터를 미리 내려받지 않습니다. 기본 설정에서 나무는 줌 14 이상에서 화면 중심 주변 후보를 선택해 최대 1,800개까지 두 개의 InstancedMesh로 그립니다. 위치·크기는 고정 규칙으로 생성합니다. 이동이 끝나거나 데이터가 준비되면 배치를 갱신하며, 지형 고도를 아직 알 수 없는 지점은 건너뜁니다. 실제 성능은 장치, 화면 해상도, 지도 복잡도와 네트워크에 따라 다릅니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `dist/index.html` | 화면 구성 |
| `dist/style.css` | 반응형 스타일 |
| `dist/cartography.json` | 지형·건물·농경지·숲의 기본 표현 설정 |
| `dist/cartography.js` | 설정 검증·편집 패널·지도 반영 |
| `CONFIGURATION.md` | 전체 설정 키와 허용 범위 |
| `dist/app.js` | 지도, 건물, 지형, 조작 기능 |
| `dist/auction-data.js` | 경매 데이터 공급 인터페이스와 UI 확인용 샘플 |
| `dist/auction.js` | 경매 클러스터·가격표·필터·상세 팝업 |
| `dist/landcover.js` | 농경지 패턴 및 숲 모듈 연결 |
| `dist/trees.js` | 지형 위 인스턴싱 나무 배치 |
| `dist/maplibre-gl.js`, `dist/maplibre-gl.css` | MapLibre GL JS 5.6.2 |
| `dist/three.module.js` | Three.js 0.160.1 |
| `licenses/` | 포함된 외부 라이브러리 라이선스 |

`dist/`를 정적 호스팅의 공개 디렉터리로 사용하면 됩니다. 이 저장소에 올리는 것만으로 기존 Sites 웹페이지와 자동 동기화되지는 않습니다.

## 데이터와 라이선스

- [MapLibre GL JS](https://maplibre.org/): BSD-3-Clause (`licenses/MapLibre-LICENSE.txt`).
- [Three.js](https://threejs.org/): MIT (`licenses/Three-LICENSE.txt`).
- [OpenFreeMap](https://openfreemap.org/): OpenStreetMap 기반 벡터 타일 및 Liberty 스타일.
- [OpenStreetMap 기여자](https://www.openstreetmap.org/copyright): ODbL. 지도에 출처 표시를 유지합니다.
- [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/): Terrarium 고도 타일. USGS SRTM/GMTED2010, NOAA ETOPO1 등. [원천별 저작권·출처](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)를 따릅니다.

지도·고도 데이터 전체는 저장소에 포함되지 않으며 실행 시 외부 서버에서 가져옵니다. 라이브러리 라이선스가 자체 작성 코드나 지도 데이터의 라이선스를 대신하지는 않습니다. 자체 코드의 별도 공개 라이선스는 아직 지정하지 않았습니다.

## 정확도와 한계

사진 기반 정밀 3D 모델이나 실시간 도시 데이터가 아닙니다. 건물 높이에 추정·기본값이 포함될 수 있으며 지도와 지형에 누락·오차가 있습니다. 농경지는 논과 밭을 구분하지 않습니다. 고랑 방향은 상징적이며 경계는 지적 경계가 아닙니다. 숲 분류는 법적 지목인 임야와 다를 수 있습니다. 나무는 실제 위치·수종·크기를 나타내지 않습니다. 지형 해상도 때문에 작은 경사·옹벽은 정확히 반영되지 않을 수 있습니다.

## 경매 레이어 (데모)

왼쪽 **경매 물건**에서 레이어를 켜고 끌 수 있고, 종류·할인율·유찰 횟수로 필터링할 수 있습니다. 멀리서는 건수가 클러스터로, 줌 14 이상에서는 최저가와 감정가 대비 할인율이 표시됩니다. 점을 누르면 감정가, 최저가, 유찰 횟수, 매각기일, 사건번호와 관할법원을 확인할 수 있습니다.

현재 `auction-data.js`의 물건은 화면과 데이터 구조를 검증하기 위한 **가상 샘플**이며 실제 법원 경매정보가 아닙니다. 실제 데이터 수집 레이어를 연결할 때에는 `AuctionData.getFeatures()`가 같은 GeoJSON 속성(`id`, `type`, `address`, `court`, `caseNumber`, `appraisalPrice`, `minimumPrice`, `discountRate`, `failedCount`, `auctionDate`, `sourceUrl`)을 반환하도록 교체하면 지도 표현과 필터는 그대로 사용할 수 있습니다. 전국 데이터를 한 번에 내려받기보다 현재 화면의 BBOX와 필터를 서버 조회 조건으로 넘기는 방식을 권장합니다.

## 가져온 상태

최초 가져오기는 기존 작업의 소스 `f10fd7f5af73a20a7aca3f5d5d044c6b5f9445cf`를 가져왔습니다. 기존 Git 커밋 그래프를 병합한 것이 아니라 파일을 가져온 스냅샷입니다. 이전 개발 단계는 `CHANGELOG.md`에 기록했습니다. Sites 전용 프로젝트 식별 설정은 포함하지 않았습니다.

검증 범위: 작성 JavaScript 구문 확인 및 업로드 파일 일치 확인. 브라우저 시각·성능 테스트는 별도로 수행하지 않았습니다.

## 카르토그래피: 소스 수정 없이 지도 표현 바꾸기

지도 요소를 **어떻게 그릴지** 정하는 표현값은 [dist/cartography.json](dist/cartography.json)에 분리했습니다. 색상·패턴·나무 크기 등을 바꾸려면 이 파일이나 화면 설정을 사용하면 됩니다.

### 1. 화면에서 조절하고 기본 설정으로 저장

1. 지도 왼쪽 **지도 표현 설정**을 펼칩니다.
2. 지형 높이·음영, 건물 색상, 농경지 패턴, 나무 모양·색·크기·밀도를 조절합니다. 변경한 값은 현재 지도에 적용됩니다.
3. **설정 내려받기**를 누르면 현재값이 담긴 `cartography.json`이 내려받아집니다.
4. 내려받은 파일로 저장소의 **`dist/cartography.json`을 교체**합니다.
5. 로컬 서버에서 새로고침해 확인한 뒤 변경 파일을 커밋·푸시하고, 사용하는 웹 호스팅에 배포합니다.

화면 조절만으로 서버 설정이나 GitHub 파일이 저장되지는 않습니다. 새로고침하면 서버의 JSON 기본값을 다시 읽습니다. **기본값 복원**은 페이지를 열 때 읽었던 파일값으로 되돌립니다.

### 2. 설정 파일을 직접 수정

[dist/cartography.json](dist/cartography.json)을 열고 필요한 값만 바꿉니다. 다음은 **숲 설정 부분의 예시**입니다. 파일 전체를 이 부분만으로 덮어쓰지 말고 기존 `forest` 객체를 교체하세요.

```json
"forest": {
  "color": "#a8c68a",
  "trees": true,
  "shape": "round",
  "crownColor": "#49774a",
  "trunkColor": "#766048",
  "heightScale": 1.2,
  "widthScale": 1,
  "density": 0.5,
  "maxTrees": 900,
  "minZoom": 14
}
```

이 예시는 둥근 수관, 나무 높이 1.2배, 기본 대비 밀도 0.5배, 최대 900그루를 설정합니다. 크기·밀도는 실제 수목 측정값이 아닌 표현값입니다.

| 바꾸려는 것 | 설정 키 | 입력 예시 |
| --- | --- | --- |
| 산·언덕 높이 배율 | `terrain.exaggeration` | `1` 실제 비율, `1.5` 과장 |
| 지형 음영 강도 | `terrain.shade` | `0.35` |
| 낮은·높은 건물 색 | `buildings.lowColor`, `highColor` | `"#d5ddd6"`, `"#12544f"` |
| 농경지 바탕색 | `farmland.color` | `"#d4c397"` |
| 농경지 패턴 | `farmland.pattern` | `"rows"` 사선, `"grid"` 격자, `"none"` 없음 |
| 패턴 간격·경계 색 | `farmland.patternSpacing`, `boundaryColor` | `8`, `"#9c8757"` |
| 입체 나무 표시·모양 | `forest.trees`, `shape` | `true`, `"cone"` 또는 `"round"` |
| 나무 크기·밀도 | `forest.heightScale`, `widthScale`, `density` | `1`은 기본 배율 |
| 나무 수 상한·표시 줌 | `forest.maxTrees`, `minZoom` | `1800`, `14` |

색상은 `#RRGGBB`, 숫자는 따옴표 없이, 표시 여부는 `true`/`false`로 입력합니다. JSON에는 주석과 마지막 항목 뒤 쉼표를 넣을 수 없습니다. 기존 필드와 `version: 1`을 유지하세요. 전체 키와 허용 범위는 [CONFIGURATION.md](CONFIGURATION.md)에 있습니다.

### 설정과 코드의 역할

| 파일 | 수정하는 경우 |
| --- | --- |
| `cartography.json` | 지원하는 색상·패턴·배율·밀도 등 기본값 변경 |
| `cartography.js` | 새 설정 항목, 허용 범위 또는 편집 UI 추가 |
| `landcover.js` | 새로운 농경지 패턴·토지피복 표현 방식 구현 |
| `trees.js` | 새로운 나무 모델·배치 알고리즘 구현 |
| `app.js` | 지도 동작 또는 데이터 소스 연결 변경 |

논·밭을 실제로 나누거나 새로운 토지피복 분류를 추가하는 것은 원본 데이터 연결 작업입니다. 설정 파일은 데이터의 의미나 경계를 바꾸지 않습니다. 화면 주변 타일 로딩과 최대 1,800그루의 나무 상한도 유지됩니다.

### 적용 확인과 주의점

- 파일 변경 후 로컬 서버에서 새로고침해 확인합니다. 별도 빌드는 필요하지 않습니다.
- GitHub에 푸시하는 것만으로 현재 Sites 웹페이지가 바뀌지는 않습니다. 해당 호스팅에도 변경 파일을 배포해야 합니다.
- 이전 값이 보이면 강력 새로고침을 시도합니다.
- 설정을 잘못 수정해 지도가 시작되지 않으면 마지막 정상 파일로 복원하고 JSON 문법과 [허용 범위](CONFIGURATION.md)를 확인합니다.


## 미니어처 모드

지도에서 **기본 지도 / 미니어처**를 전환하고 **남산 미니어처 둘러보기**로 예시 지역을 열 수 있습니다. 미니어처는 밝은 지면·도로, 크림색 외벽, 둥근 수관을 사용합니다. 줌 15 이상에서 중심 주변 1.8km 이내·화면 안의 가까운 건물 최대 240개에 지붕 장식을, 최대 4,000개 창문을 표시합니다. 이동 후 갱신하며 원래 건물 윤곽과 높이는 유지합니다. 25m 미만의 사각형 건물 중 직각에 가까운 윤곽에만 경사지붕을 얹고, 복잡한 윤곽은 평지붕으로 표현합니다. 세부 모형을 선택하지 않은 건물도 기존 지도에서 계속 표시됩니다.

추가 설정은 `cartography.json`의 `appearance`입니다.

| 키 | 값 |
| --- | --- |
| mode | standard / miniature |
| roofs | 낮은 사각형 건물의 경사지붕 여부 |
| windows | 창문 장식 표시 여부 |
| wallColor | 미니어처 외벽 색 |
| roofColor | 낮은 건물의 지붕 색 |
| windowColor | 창문 색 |

새 설정의 기본 모드는 miniature입니다. appearance가 없는 기존 설정 파일은 standard 모드로 읽습니다. 지도 표현 설정에서 변경하고 설정 내려받기로 재사용할 수 있습니다. 미니어처 모드에서는 숲의 나무 모양·수관 색을 모형용 프리셋으로 덮어쓰며, 기존 숲 설정은 기본 지도로 돌아오면 적용됩니다. `miniature-style.js`는 지도 프리셋, `miniature.js`는 건물 세부 형상을 담당합니다.

건물 외관·지붕·창문은 실제 측량 자료가 아닌 장식입니다. 건물 누락은 보완하지 않습니다. 지형과 건물 높이의 차이로 장식 정렬에 오차가 생길 수 있습니다. 현재는 조명에 의한 입체 명암을 사용하며, 건물 간 투영 그림자·정밀 랜드마크·사람·차량 모델은 포함하지 않습니다. 브라우저 시각·성능 테스트는 수행하지 않았습니다.
