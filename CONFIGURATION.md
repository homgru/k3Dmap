# 지도 표현 설정

`dist/cartography.json`은 기본 표현값, `dist/cartography.js`는 검증과 설정 패널, 나머지 모듈은 지도 렌더링을 담당합니다. 색상·밀도 등을 바꿀 때 렌더링 소스를 수정할 필요가 없습니다.

## 화면에서 바꾸기

왼쪽 **지도 표현 설정**을 펼쳐 값을 조절합니다. 현재 지도에 적용되며 새로고침하면 파일 기본값으로 돌아갑니다. **설정 내려받기**를 누르면 현재값이 담긴 `cartography.json`을 받습니다. 이 파일로 저장소의 `dist/cartography.json`을 교체하고 사용하는 호스팅에 배포하면 모든 사용자의 기본값이 됩니다. **기본값 복원**은 처음 읽은 파일값으로 돌아갑니다.

## 설정 항목

| 그룹 | 키 | 값 / 범위 |
| --- | --- | --- |
| terrain | enabled | 입체 지형 표시 여부 |
| terrain | exaggeration | 높이 배율 0–3, 기본 1 |
| terrain | shade | 음영 강도 0–1 |
| buildings | enabled | 입체 건물 표시 여부 |
| buildings | lowColor, highColor | 낮은/높은 건물 색상 |
| buildings | opacity | 불투명도 0–1 |
| farmland | color, opacity | 바탕색·불투명도 |
| farmland | pattern | rows(사선), grid(격자), none(없음) |
| farmland | patternColor, patternSpacing | 패턴 색·간격 4–16 |
| farmland | boundaryColor | 지도에 등록된 농경지 영역 경계 색 |
| forest | color, trees | 숲 바탕색·입체 나무 여부 |
| forest | shape | cone(원뿔), round(둥근 수관) |
| forest | crownColor, trunkColor | 수관·줄기 색 |
| forest | heightScale, widthScale | 높이·너비 배율 0.5–2 |
| forest | density | 배치 밀도 배율 0.25–2 |
| forest | maxTrees | 최대 나무 수 0–1800 |
| forest | minZoom | 나무 표시 시작 줌 13–18 |

색상은 `#RRGGBB`, 표시 여부는 JSON boolean으로 입력합니다. `version`은 1을 유지합니다. 표에 없는 필드를 제거하거나 지원 범위 밖의 값을 넣으면 시작 시 설정 검증이 실패할 수 있습니다. opacity와 enabled 등 일부 항목은 파일 또는 기존 표시 체크박스에서 조절합니다.

숲 경계, 논·밭 통합 분류 등 실제 데이터는 이 파일이 바꾸지 않습니다. 별도 원천 데이터 연결은 별도 작업입니다. 화면 주변 타일 로딩과 나무 상한은 유지됩니다. 나무 밀도 변경은 배치 간격을 바꾸므로 위치도 달라질 수 있으나 같은 설정에서는 고정된 규칙을 사용합니다. 지형 배율 1 이외의 값은 실제 높이 비율이 아닙니다.
