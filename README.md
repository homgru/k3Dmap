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
- 높이 과장 없는 지형 DEM 및 음영, 지형 켜기/끄기
- 농경지 고랑 패턴과 지도상 영역 경계
- 숲에 단순한 줄기·원뿔 수관의 입체 나무 표시

## 성능과 나무 배치

MapLibre가 화면에 필요한 지도·고도 타일을 요청하고 캐시합니다. 전국의 상세 데이터를 미리 내려받지 않습니다. 나무는 줌 14 이상에서 화면 중심 주변 후보를 선택해 최대 1,800개까지 두 개의 InstancedMesh로 그립니다. 위치·크기는 고정 규칙으로 생성합니다. 이동이 끝나거나 데이터가 준비되면 배치를 갱신하며, 지형 고도를 아직 알 수 없는 지점은 건너뜁니다. 실제 성능은 장치, 화면 해상도, 지도 복잡도와 네트워크에 따라 다릅니다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `dist/index.html` | 화면 구성 |
| `dist/style.css` | 반응형 스타일 |
| `dist/app.js` | 지도, 건물, 지형, 조작 기능 |
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

## 가져온 상태

기존 작업의 최종 소스 `f10fd7f5af73a20a7aca3f5d5d044c6b5f9445cf`를 가져왔습니다. 기존 Git 커밋 그래프를 병합한 것이 아니라 파일을 가져온 스냅샷입니다. 이전 개발 단계는 `CHANGELOG.md`에 기록했습니다. Sites 전용 프로젝트 식별 설정은 포함하지 않았습니다.

검증 범위: 작성 JavaScript 구문 확인 및 업로드 파일 일치 확인. 브라우저 시각·성능 테스트는 별도로 수행하지 않았습니다.
