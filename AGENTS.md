# 에이전트 작업 규칙

작업을 끝났다고 말하기 전에 [`.cursor/skills/verify-k3dmap/SKILL.md`](.cursor/skills/verify-k3dmap/SKILL.md)를 따라 검증한다.

```sh
node scripts/verify_k3dmap.mjs smoke
```

이 명령이 실패하면 완료로 보고하지 않는다. 지도 화면, 설정 패널, 공매 레이어, 미니어처를 바꿨으면 `features/`에서 해당 항목도 같은 스킬의 명령으로 한 번 구동한다.
