# UI Contract 느슨한 점검 및 보강 기록

## 범위와 판정

- 정본: `.aiops-spec/ui-design.md`의 Route Inventory, Screen Action Mapping,
  화면별 UI 계약(7327–7374행) 및 관련 Story의 동작·검증·상태 정의.
- ASCII 위치·간격·배치·컬럼 순서는 결함 판정에서 제외했다.
- frontend의 명백한 기능 누락만 보강했다. backend, persistence, OpenAPI 및
  `tests/e2e`는 변경하지 않았다. 이 기록은 전체 요구의 완전 충족 인증이나 pipeline gate가 아니다.
- 실제 OpenAPI의 `ApiError`는 단일 `field`를 사용한다(1334–1337행).
  `fields` map은 만들지 않았다. 미정 필드 경로를 임의로 해석하지 않았다.

## 화면별 계약 체크리스트와 대조

### SCR-SIGNUP — /signup

- 목적·형태: 계정 생성 후 자동 로그인, 이메일·닉네임·비밀번호·확인 세로 폼.
- CTA: 회원가입, 로그인 진입. signup 성공 뒤 같은 세션을 확인하고 /resumes 이동.
- 필드·payload: 확인은 로컬 검증용이고 signup payload에 제외. password_hash 미노출.
- 검증·상태: 이메일 형식, 닉네임 2–12자, 비밀번호 8자 이상, 확인 일치,
  서버 단일 field 오류, 처리 중·조회 실패·재시도 상태가 구현되어 있다.
- 이번 변경 없음. 인증된 사용자의 인증 route 재진입 정책은 미확정 사항으로 분리했다.

### SCR-LOGIN — /login

- 목적·형태: 이메일·마스킹 비밀번호로 인증.
- CTA·payload: 로그인, 회원가입 진입. email/password만 인증 payload로 전달.
- 검증·성공: 가입의 8자 규칙을 로그인에 적용하지 않으며 성공 후 /resumes 이동.
- 상태·권한: 오류 시 인증 폼 유지, 서버 field 오류 표시, 세션 조회 실패 재시도.
- 이번 변경 없음. return URL 자동 복귀나 새 역할·기간 제한은 추가하지 않았다.

### SCR-RESUME-LIST — /resumes; /는 진입 별칭

- 형태·목적: 자기 활성 이력서의 최근 수정순 카드, 서버 목록·동일 renderer 썸네일.
- CTA: 첫 새 이력서 카드, 선택 카드 편집, 이름 변경, 즉시 복제, 확인 후 삭제.
- 모드·필드: 생성은 title/template, 이름 변경은 title만 입력.
  id는 선택 카드/생성 응답에서 사용하고 소유자·서버 수정 시각은 편집하지 않는다.
- payload: 생성 title/template, 이름 변경 title만 PATCH; 복제·삭제는 선택 id의 path.
- 성공·문맥: 생성은 새 id 편집기로 이동, 이름 변경·복제·삭제는 같은 목록 페이지 재조회.
- 상태·권한: loading/empty/error/retry, 요청 중 비활성, 401 로그인 이동이 있다.
- 보강: 생성 template의 서버 field 오류를 선택 필드에 연결하고 실패 시 제목·선택을 유지.
  title 오류와 같은 방식으로 aria-invalid/aria-describedby를 제공한다.

### SCR-RESUME-EDITOR — /resumes/:id/edit

- 형태·목적: 입력·A4 비교; 모바일 입력/미리보기 탭; 완성도·섹션·설정 영역.
- CTA: 제목 수정, 목록 이동, 실패 저장 재시도, 스타일, PDF, 사진, 섹션·항목 조작.
- 불변·필드: basics 이동·숨김·삭제 불가; id/updated_at/소유자는 입력 필드가 아니다.
  current=true인 경력·학력의 end 비활성. 프로젝트에 current 입력을 추가하지 않는다.
- payload: 자동저장은 template/style/content만 PUT; 제목은 별도 title PATCH.
  숨김·정렬 시 기존 데이터 보존; 항목 상한 20, 태그 30, 링크 3이 구현되어 있다.
- 성공·문맥: 직렬 자동저장, 실패 시 로컬 입력 유지·재시도, 목록 이동 전 최종 저장,
  숨김 제외 완성도/PDF 필수 검사, 누락 항목 클릭 시 입력 포커스가 구현되어 있다.
- 검증: 이메일·날짜·역전 경고로 저장을 차단하지 않는다.
- 보강: 필수값 표시와 aria-required를 추가하되 native required를 적용하지 않아
  불완전한 내용의 자동저장·목록 이동 저장을 막지 않는다.
- 보강: 제목의 서버 title 오류를 입력에 연결하고 거부된 draft·기존 제목을 보존한다.
- 보강: 사진 영역/변경 CTA로 기존 파일 input을 열며 선택 취소는 업로드하지 않는다.
  JPG·PNG/2MB 안내 및 같은 파일 재선택을 위한 input 초기화를 제공한다.
- 보강: 신뢰된 현재 인쇄 iframe의 401 메시지를 부모 /login 이동에 연결한다.
  다른 origin 또는 다른 window의 메시지는 무시한다.

### SCR-RESUME-PRINT — /print/:id; 숨긴 iframe 전용

- 목적·형태: 부모의 필수 검사·필요 저장 성공 후 서버 저장본을 동일 A4 renderer로 출력.
- CTA·필드: 사용자 편집·앱 인쇄 확인 버튼·직접 메뉴를 추가하지 않는다.
- 상태·권한: 조회/글꼴/이미지/렌더 실패는 인쇄 성공으로 대체하지 않는다.
- 보강: SessionBoundary 또는 저장본 GET의 401을 일반 준비 실패와 구분하여 부모에 전달.
- 보강: renderer가 준비 완료 전에 실패해도 부모에 실패를 전달하여 iframe·준비 상태를 정리.
- 보강: PDF document.title을 REQ-110의 `이름_희망직무_이력서`로 적용.

메뉴의 세 부분 문자열은 OQ-UI-001의 정보구조 제안이다. 별도 sidebar/menu를 만들지 않았다.
명세에 없는 기간 gate나 관리자 역할, 임의 확정 상태 잠금은 만들지 않았다.

## 남은 gap — 이번 최소 보강에서 미해결

### 남은 구현 drift

1. 실제 편집기·ResumeRenderer 사진은 raw img로 `/api/photos/{id}`를 조회한다.
   getPhoto의 401/404 상태를 판별하는 PhotoImage는 실제 renderer 경로에 연결되지 않았다.
   따라서 사진 조회만 401인 경우 일반 이미지 실패와 로그인 이동을 구분하지 못한다.
   사진 blob 로딩을 통합할 때 pagination·원본 decode 준비·인쇄 실패 전파까지 함께 검증해야 한다.
2. 본문 자동저장의 서버 field 오류는 토스트로 표시되지만 각 본문 입력에 연결하지 않는다.
   현재 API는 단일 field이며 정확한 nested 경로 규칙은 OQ-011이다.
   본문 경로를 추정하여 잘못된 입력에 오류를 붙이지 않았다.
3. 제목 변경 성공은 현재 입력 제목을 메모리에 반영한다. UI 계약의 getResume 재조회는 하지 않는다.
   전체 재조회가 동시 본문 편집·저장 큐를 덮어쓰지 않도록 별도 동기화 검증이 필요하다.

### API/설계 확인 필요 — 임의 구현하지 않음

- OQ-003: small/medium/large와 9/10/11pt 매핑은 미확정이다.
  현재 코드의 대응을 승인된 계약으로 취급하지 않았고 다른 대응도 발명하지 않았다.
- OQ-002: 긴 항목 분할 및 modern 이어짐의 상세 정책.
- OQ-UI-002/OQ-006: 인증 route 재진입, 세션 만료 복구·CSRF·TTL.
  현재 로그인 사용자 인증 route 재진입의 목록 이동은 기존 구현을 유지했다.
- OQ-UI-301: 미저장 상태의 로그아웃과 선행 저장 순서. 기존 flush 선행을 유지했다.
- OQ-004/OQ-011: 공백 제목·최대 길이·본문 오류 field 경로·envelope 세부.
- OQ-008/OQ-017/OQ-018: 항목 id 발급, 초기 섹션/항목 값 등 기존 구현 선택의 승인 필요.
- OQ-009: current 해제 시 end 복원/초기화. 기존 end 보존 정책을 유지했다.

## 실행 검증

- 수정 전: Vitest 11개 파일, 103개 테스트 통과.
- 신규 회귀 8개는 해당 기능이 없는 기존 구현에서 실패를 확인한 후 보강했다.
- 최종 `npm test -- --run`: 12개 파일, 111개 테스트 통과.
- `npm run typecheck`: 통과.
- `npm run build`: 통과.
- 기존 React Router future flag 경고와 router 테스트의 act 경고는 남아 있다.
- 기본 API target `http://127.0.0.1:8080/api/health`는 연결 거부(HTTP 000).
  실서버·실브라우저 E2E는 실행하지 않았다. tests/e2e 수정 및 playwright install도 하지 않았다.
  Vitest의 route/API 테스트는 제어된 응답을 사용한 frontend 검증이며 실제 DB E2E 검증이 아니다.
