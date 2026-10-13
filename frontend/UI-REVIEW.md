# UI 개선 체크리스트

## 레퍼런스 직접 관찰

설치된 Playwright 1.51.1 Chromium으로 https://rxresu.me/ 및 /auth/login을 직접 열었다.
인증 화면은 따뜻한 off-white 배경, 중앙의 좁은 폼, serif 제목, 녹색 CTA,
작은 라벨과 밝은 입력 필드로 구성된다. 빈 폼 제출 시 필드 검증이 표시된다.
/dashboard는 /auth/login?callbackURL=%2Fdashboard로 이동했다.
실제 계정 없이 보호 dashboard/builder를 관찰했다고 주장하지 않는다.
보호 화면은 ui-style.md의 소스 분석을 보조 근거로 사용한다.
프로젝트에 없는 OAuth, AI, 공유, sidebar, 검색, pagination은 추가하지 않는다.

## 코딩 전 화면별 계약

- /login — 계정 > 인증 > 로그인; authentication form.
  이메일/password → POST /api/auth/login → GET /api/auth/me → /resumes.
  빈 폼/처리중/필드 및 서버 오류를 구분하고 실패 시 이동하지 않는다.
- /signup — 계정 > 인증 > 회원가입; registration form.
  email/nickname/password만 POST /api/auth/signup에 전송한다.
  confirmation은 로컬 검사이며 payload에서 제외한다. nickname 2~12자,
  password 8자 이상. 같은 세션 확인 후 /resumes; 중복/확인 실패를 구분한다.
- /resumes — 이력서 > 내 이력서 > 이력서 목록; document library.
  GET /api/resumes의 id/title/template/style/content/updated_at을 사용한다.
  첫 칸 생성 → title/template POST → 응답 id 편집기로 이동.
  선택 id PATCH(title)/POST duplicate/확인 후 DELETE → GET 목록 갱신.
  서버 nickname readonly; 오류/빈 결과/로딩 구분; 쓰기 중 중복 제출 금지.
  실제 메뉴 경로는 분류이며 새로운 상시 sidebar를 만들지 않는다.
- /resumes/:id/edit — 이력서 > 내 이력서 > 이력서 편집기; split editor.
  GET 자료 → content/style/template 변경 및 실시간 A4 → 1.5초 직렬 PUT.
  PUT payload는 title/template/style/content; id/updated_at 제외.
  제목 PATCH, 사진 POST /api/photos 및 GET /api/photos/:id,
  photoId 교체/해제 후 공용 PUT. basics 삭제/숨김/이동 금지.
  섹션 삭제 확인, 항목 20개/태그 30개 상한, current 종료일 disabled 유지.
  실패 시 입력 보존 및 저장 재시도. 목록 이동은 저장 성공 뒤에만 허용.
  설정은 같은 좌측 패널, 1024px 미만 입력/미리보기 탭.
  PDF 필수 검사 → 최신 저장 → 숨긴 /print/:id iframe; 실패 시 차단.
- /print/:id — 이력서 > 내 이력서 > 인쇄 화면; iframe print document.
  저장된 GET 및 연결 사진으로 같은 ResumeRenderer를 렌더한다.
  폰트/이미지 완료 후 print; shell/메뉴 제외; 일반 탭 직접 인쇄 금지.

## API 및 구현 대조

기존 React Router의 다섯 화면과 root redirect가 모두 존재한다.
ResumeController/ResumeService/ResumeWrite 및 frontend shared/contracts.ts와
resumesApi.ts의 payload/envelope는 일치한다. updated_at 원문 key를 유지한다.
ApiError는 실제 backend 계약의 단일 field를 사용하며 fields를 발명하지 않는다.
기존 영속성/컨트롤러 및 SaveCoordinator는 변경하지 않는다.
size의 pt 대응은 기존 구현을 유지하고 추가 정책을 확정하지 않는다.

## 코딩 후 대조 및 검증 결과

- 다섯 route 및 root redirect 유지. sidebar/추가 메뉴/가상 문서 데이터 없음.
- 인증 폼: 중앙 정렬, 레퍼런스의 352px 폼 폭, muted green CTA,
  로컬 Hanken Grotesk/Newsreader latin 폰트 및 OFL 라이선스 포함.
  한글은 시스템 fallback을 사용하며 이력서 template 폰트에는 영향 없음.
- 목록: 제목/응답 건수/빈 상태, 정적 paper skeleton, 수정 시각 현지화,
  A4 카드 및 실제 폭 기반 ResizeObserver 배율 적용.
  기존 CSS typed division이 Chromium에서 scale=1로 처리되는 실패를
  E2E에서 확인한 뒤 수정했다. 카드 anchor 밑줄의 문서 전파도 제거했다.
- 메뉴: Escape 및 바깥 pointer click 닫기, 기존 선택 id 명령 유지.
  popup 전용 animation으로 dialog의 translate(-50%, -50%) 적용 오류 제거.
- 편집기: 조회 실패의 같은 id 재조회, 입력/저장/설정/출력 흐름 유지.
  저장 상태 dot, 설정 toggle, 완성도 트랙, 필드 focus 및 preview 툴바 정리.
  390px 모바일에서 입력/미리보기 전환 및 가로 overflow 없음 확인.
- 인쇄: UI chrome CSS는 ResumeRenderer/print의 template 계약을 변경하지 않음.
  필수 누락 모달과 해당 필드 focus, 저장 후 숨긴 iframe 조회/렌더 및
  window.print 호출을 E2E로 확인. 테스트에서 native print dialog만 대체하며
  API 요청/응답은 intercept하지 않았다. 실제 PDF 파일 생성 검증은 아님.

실행한 명령과 실제 결과:

1. npm test -- --run: 11개 test file, 108개 test 통과.
   새 skeleton/메뉴 dismiss/조회 retry 시험은 수정 전 3개 실패를 관찰했다.
2. npm run build: TypeScript 검사 및 Vite production build 통과.
3. Docker Compose의 별도 resumecraft-ui-review 프로젝트에서
   PostgreSQL/backend/frontend 빌드·기동 및 /api/health 성공 확인.
4. E2E_BASE_URL=http://172.21.0.4:8080 npm run test:e2e:
   마지막 코드/스펙 수정 후 실제 DB-backed workflow 1개 통과.
   가입 검증/자동 로그인/빈 목록/생성/실시간 렌더/자동저장/설정 보존/
   재진입/PDF 필수 검사/iframe 인쇄/이름 변경/복제/삭제 취소 및 확인/
   로그아웃/재로그인/보호 route와 desktop/mobile viewport를 포함한다.
   Docker published localhost는 이 실행 컨테이너에서 연결되지 않아
   실제 frontend container IP를 E2E_BASE_URL로 전달했다.
5. /tmp/resumecraft-login-desktop.png, /tmp/resumecraft-library-empty.png,
   /tmp/resumecraft-library-desktop.png, /tmp/resumecraft-library-mobile.png,
   /tmp/resumecraft-editor-desktop.png, /tmp/resumecraft-editor-mobile.png를
   생성하고 주요 desktop/mobile 스크린샷을 시각 검토했다.

남은 확인 사항:

- 레퍼런스의 보호 dashboard/builder는 계정 없이 직접 관찰하지 못했다.
- 원문 OQ의 pt 대응 등 미승인 정책은 이번 스타일 개선으로 해소하지 않는다.
- 기존 React Router future flag 경고와 npm audit의 취약점 12건
  (moderate 4, high 6, critical 2)은 범위 밖 의존성 major 변경 없이 남겨 두었다.
- API/persistence/backend 파일은 변경하지 않았다.
