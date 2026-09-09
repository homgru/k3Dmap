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
