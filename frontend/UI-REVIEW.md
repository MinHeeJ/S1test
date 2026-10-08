# UI 개선 계약 체크리스트

## 구현 전 조사

- 기존 React Router와 순수 CSS를 유지한다. UI 라이브러리·별도 sidebar·landing을 추가하지 않는다.
- 서버 Controller/Service/ResumeDocument와 resumeApi를 대조했다.
- 응답은 success/meta/data, 오류는 code/message/field다. updated_at 원문 필드를 유지한다.
- PUT payload는 template/style/content만, 제목 변경은 PATCH {title}다.
- 목록은 실제 GET page/size를 순회한다. 생성/복제의 응답 data.id를 사용한다.
- 사진은 POST multipart와 GET bytes를 유지하고 본문 photoId만 연결/해제한다.

## 화면별 체크리스트

| route / 메뉴 맥락 | 사용자 목적 / 유형 | CTA / payload | 필드·검증·성공·제약 |
| --- | --- | --- | --- |
| /signup / 접근·계정·회원가입 | 계정 생성 / registration | 가입 POST /api/auth/signup | email/nickname/password만 전송, 확인은 로컬; 2~12자·8자·확인 일치; 오류 field 표시, 중복 거부, 성공 세션 확인 후 /resumes |
| /login / 접근·계정·로그인 | 세션 인증 / authentication | 로그인 POST /api/auth/login, 가입 Link | email/password; 요청 중 중복 차단, 실패 화면 유지·토스트, 성공 /me 확인 후 /resumes |
| /resumes / 이력서·내 이력서·목록 | 본인 문서 관리 / library | 생성 POST, 이름 PATCH, 복제 POST, 삭제 DELETE | 첫 생성칸·2~4열·공유 Renderer 썸네일·title/updated_at; 대상 id 보존, 삭제 확인·취소, 성공 GET refresh, 재조회 실패를 쓰기 실패와 구분 |
| /resumes/:id/edit / 이력서·작성·편집 | 입력과 결과 비교 / editor | PUT 자동저장, PATCH 제목, 목록 이동, 설정, PDF | basics 고정·숨김/삭제 금지; hidden 내용 보존; current 종료 disabled; 날짜 경고 비차단; 20항목/30태그/3링크; 직렬 1.5초 저장·재시도·beforeunload·목록 이동 전 flush |
| /print/:id / 이력서·출력·PDF | 저장된 문서 인쇄 / iframe-only | GET /api/resumes/{id}, 로컬 print | 메뉴로 노출하지 않음; 선행 필수검사·저장; readonly 공유 Renderer·폰트/사진 준비·A4; 오류면 출력 성공 금지 |

## 공통 상태와 배치

- loading: 정적 종이 skeleton과 접근 가능한 status, 조회 전 변이 CTA 차단.
- empty: API의 실제 빈 목록에만 안내, 첫 생성 CTA 유지.
- error: 로드 오류와 빈 결과 구분, 재시도; 401 로그인 이동, 404 내용 미노출.
- success: 3초 토스트, 변이 후 목록 refresh 또는 새 id 편집 이동.
- Reference: 따뜻한 황회색 바탕, 녹색 CTA, 얇은 경계, 세리프 제목, 문서 종이만 흰색.
- 인증은 중앙 단일 컬럼, 목록은 종이 카드+아래 메타데이터, 편집은 입력·A4 비교.
- 1024px 미만은 입력/미리보기 탭. 실제 컨테이너 폭으로 맞춤 배율을 계산한다.
- ASCII의 배치·컬럼 순서·공백은 복제하지 않는다.

## 확인 필요

- 명세에 남은 OQ-003 글자 크기 매핑은 기존 small/medium/large 동작을 변경하지 않는다.
- 메뉴 경로는 정보구조 맥락이며 별도 3단 메뉴 생성 승인이 아니다.
- 정확한 사진 실패 복구 정책은 미정이다. 출력은 안전하게 중단하며 저장된 photoId를 변경하지 않는다.

## UI Contract 느슨한 보강 점검

이 기록은 전체 명세 준수 인증이나 pipeline 실패 게이트가 아니다.
ASCII 위치·간격·컬럼 순서를 강제하지 않고 기존 사용자 기능의 명백한 누락만 수정했다.
backend, OpenAPI, persistence, route 구조와 PUT/PATCH payload는 변경하지 않았다.

### 확인한 기존 기능

- `/` → `/resumes`, `/login`, `/signup`, `/resumes/:id/edit`, `/print/:id` route와 세션 진입 경계가 있다.
- 생성 성공의 서버 id로 편집 진입, 선택 카드 id 기반 이름 변경·복제·삭제와 목록 재조회가 있다.
- 이력서·섹션 삭제 확인/취소, 항목 즉시 삭제, basics 이동·숨김·삭제 조작 제외가 있다.
- current=true 종료일 disabled와 기존 end 보존, 날짜/이메일 경고의 자동저장 비차단이 있다.
- 직렬 자동저장·재시도·목록 이동 전 flush·beforeunload, PDF 필수 검사·누락 필드 포커스가 있다.
- 서버 소유 id/user_id/deleted/시각은 사용자 편집 필드로 추가하지 않았다.
- 메뉴 경로는 설계상 제안으로 남기고 별도 3단 메뉴를 만들지 않았다.

### 최소 보강

| 계약 근거 | 누락 | 수정 |
| --- | --- | --- |
| US3-EDITOR-LOGOUT, REQ-091, REQ-061 | 편집기 logout 401이 일반 이동 실패로 처리됨 | 공통 failure로 /login 이동; 기타 오류는 서버 메시지 표시·편집 유지 |
| US39-A03, US39 error 상태 | PATCH 성공 뒤 GET 실패를 이름 변경 실패로 표시 | 변경된 제목·본문 유지, 모달 종료, 결과 조회 실패 안내; PATCH 재전송 없음 |
| REQ-115, 제목 오류 연결 | 편집기 제목 오류가 일반 문구뿐이고 입력과 접근성 연결 없음 | 서버 메시지 및 aria-invalid/aria-describedby 연결; 요청 중 제목 입력 비활성 |
| US35, REQ-101 | 완성도 조회에 충족 기준까지 모두 표시 | 미충족 기준과 기여 점수만 표시; 본문 변이·추가 API 호출 없음 |
| REQ-108, REQ-110, print Data Binding | document.title이 resume.title 사용 | 서버 basics.name/jobTitle로 이름_희망직무_이력서 구성 |

### 남은 gap / 확인 필요 — 비차단

- OQ-003: 기존 small/medium/large ↔ 9/10/11pt 대응은 명세에서 미해소다.
  이번 보강에서 기존 매핑을 변경하거나 승인된 것으로 판정하지 않았다.
- 오류 스키마는 `ApiError.field: string | null`이다. `fields` map을 발명하지 않았다.
  인증 입력과 제목 오류는 표시되지만 PUT의 content/style 등 구조 오류를 개별 중첩 입력에
  연결할 안정적인 field 경로 계약은 없다. 기존 저장 실패·토스트를 유지한다.
- 쓰기 API 404는 저장 실패·오류 표시가 있지만 이후 편집 조작을 일괄 차단하는 상태는 없다.
  초기 GET 404의 본문 미노출은 구현되어 있다. 후속 상태 보강 후보로 기록한다.
- 목록 이름 변경의 버튼 저장은 동작하지만 Enter 폼 제출은 아직 연결되어 있지 않다
  (ACT-US6-SAVE). 이번 보강은 편집기 오류·결과 구분에 한정했다.
- OQ-UI-301/OQ-UI-039-02: logout 및 제목 PATCH와 미저장 변경의 경합 정책은 미정이다.
  기존 flush 순서를 유지하고 새 폐기·복구·취소 정책을 추가하지 않았다.
- OQ-UI-001/002/003/006, OQ-009 및 사진 오류 정책은 승인 사실을 추가하지 않고 유지한다.

### 실제 검증

- 추가 회귀 테스트 6개: 수정 전 6개 실패를 관찰하고 수정 후 통과했다.
- `npm test -- --run`: 7개 파일, 91개 테스트 통과.
- `npm run build`: TypeScript 검사와 Vite production build 통과.
- React Router v7 future flag 안내 경고는 기존 상태로 남아 있다.
- Playwright 기본 대상 `http://localhost:13040/api/health` 연결 실패.
  이번 점검에서 실제 API/browser E2E·인쇄 대화상자·DB 영속성은 재검증하지 않았다.
  이전 실행 산출물을 이번 검증 증거로 간주하지 않는다.
