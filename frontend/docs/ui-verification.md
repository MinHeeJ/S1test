# UI 검증 결과

## 확인한 레퍼런스

- https://rxresu.me/ 및 /auth/login, /auth/register에 설치된 Chromium으로 직접 접속.
- 데스크톱 1440×1000, 로그인 모바일 390×844에서 screenshot 확인.
- 로그인 email focus의 실제 border/box-shadow 및 계정 전환 링크 확인.
- /dashboard/는 /auth/login으로 redirect. 인증된 dashboard/builder 픽셀 일치는 검증하지 않았다.
- 레퍼런스의 Hanken Grotesk / Newsreader Latin WOFF2를 로컬 제공하고 OFL license 동봉.
- 한국어 glyph는 CSS에 지정한 한국어/system fallback을 사용한다.
  앱 chrome 폰트와 이력서 font/size enum은 별개로 유지한다.

## 변경 후 체크리스트 대조

- 5개 화면 route와 / alias 유지. 전역 메뉴·새 관리자·OAuth 등 미지원 기능 추가 없음.
- 인증 요청은 실제 email/nickname/password shape, confirmation 로컬 검증 유지.
- 목록은 실제 GET /api/resumes 데이터와 동일 ResumeRenderer의 첫 페이지 썸네일.
  반응형 썸네일은 ResizeObserver로 카드 너비에 맞춤.
- 생성·이름 변경·복제·삭제 대상 id, 삭제 확인/취소, 성공 refresh 유지.
- 느린 이전 검색 응답이 최신 검색을 덮지 않도록 request version 적용.
- loading skeleton, empty, 조회 오류, 모달 validation 오류를 각각 분리.
  mutation 성공 뒤 refresh 실패도 mutation 실패와 다른 메시지 사용.
- 편집기 설정은 입력 영역을 교체하고 미리보기/content를 보존.
- 섹션 접기/펼치기, 항목 수, 완성도 progress, 저장 상태 구분 적용.
- 기존 basics 고정, hidden 데이터 유지, current 종료 disabled, item/tag/link 상한 유지.
- PDF 누락 항목 클릭으로 설정·접힌 섹션·접힌 항목을 열고 해당 필드 focus.
- 사진·필드·스타일·자동저장 API와 기존 backend persistence는 수정하지 않음.
- 모바일 카드 메뉴가 하단 내비게이션에 가려지던 문제를 E2E에서 재현한 후 상향 배치로 수정.
- desktop/mobile screenshot에서 카드 정렬·편집 영역·A4 fit 및 overflow 확인.

## 실행 근거

수정 전 regression test의 실패를 확인한 후 수정했다:
조회 오류/empty 혼동, skeleton 누락, 설정 위치·입력 교체, 편집기 재시도,
섹션 접기, PDF 접힌 항목 focus, 제목 validation의 중복 alert/카드 제거.

최종 실행 명령:

```sh
cd frontend
npm test -- --run
npm run build
E2E_BASE_URL=http://127.0.0.1:4179 npm run test:e2e
```

- Vitest: 6 files, 94 tests passed.
- TypeScript typecheck + Vite production build passed.
- Playwright 1.51.1: 2 E2E tests passed.
- 실제 신규 세션/계정 및 PostgreSQL API 사용; HTTP 응답 fixture 대체 없음.
- 첫 E2E: 가입 → 이력서 생성 → 기본정보·스타일 저장 → reload 및 GET 재검증 →
  readonly print route → 이름 변경 → 복제 → 삭제 취소/확인 → 로그아웃/로그인.
- 두 번째 E2E: 390px 화면, 1023px tabs/1024px split 경계, 모바일 A4 thumbnail 너비,
  네트워크 차단으로 실제 조회 실패 → 재시도 복구.
- print route의 window.print만 테스트에서 대체하여 브라우저 인쇄 대화상자를 막았다.
  PDF 파일 다운로드 및 프린터 출력 자체는 검증 범위가 아니다.
- screenshot: frontend/test-results/editor-desktop.png, editor-mobile.png,
  library-desktop.png, library-mobile.png.
- 가입 trace에 credential이 포함될 수 있으므로 trace 저장 비활성화 및 생성 trace 제거.
  screenshot·test-results·playwright-report는 .gitignore 대상이다.
- 기존 검증용 backend는 현재 CSRF bootstrap 헤더와 달라 현재 저장소 backend를 별도
  Compose project/DB로 빌드해 검증했다. 보안 우회·기존 컨테이너 재시작 없음.

## 확인 필요

- 명세의 미확정 pt ↔ small/medium/large 매핑은 기존 enum 그대로 유지.
- 레퍼런스 인증된 editor/dashboard의 세부 interaction은 계정 없이 확인 불가.
- React Router v7 future-flag warning은 기존 test 실행에도 표시되며 테스트 실패는 아니다.
- npm install 환경은 Node 22이며 manifest는 Node 20.x를 요구하여 engine warning이 있다.
  production build는 통과했다. Node major 및 나머지 dependency major를 임의 변경하지 않았다.
- npm audit는 11건을 보고했다. 이번 UI 작업에서는 major upgrade/강제 audit fix를 실행하지 않았다.
