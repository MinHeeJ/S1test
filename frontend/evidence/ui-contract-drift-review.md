# UI Contract 느슨한 점검 및 최소 보강

## 범위와 판정

- 기준: `.aiops-spec/ui-design.md`의 Route Inventory, Screen Action Mapping,
  화면별 UI 계약(7327–7374행)과 관련 Feature의 동작·입력·상태 제약.
- ASCII 위치·간격·컬럼 순서·정확한 배치는 미적용 판정에서 제외했다.
- frontend 사용자 기능과 기존 API 요청·오류 형태를 비교했다.
  backend API, DB, persistence, spec 원본은 변경하지 않았다.
- 전체 파일의 모든 요구를 인증하는 완전한 감사나 pipeline 차단 검증이 아니다.
  명백한 사용자 기능 누락만 보강하고 미해소 항목은 아래에 남긴다.
- 시작 시 앱 파일들이 모두 untracked였다. 기존 산출물을 제거하거나 stage/commit하지 않았다.

## 화면별 계약 체크리스트와 확인 결과

| 화면 | 우선 확인 계약 | 이번 판정 |
| --- | --- | --- |
| `/signup` | email/nickname/password/확인; 확인은 로컬 전용; signup 후 목록 | 기존 구현 유지 |
| `/login` | email/password; 실패 유지; 성공 목록; 가입 길이 제한 전용 금지 | 기존 구현 유지 |
| `/resumes` | 활성 목록; 선택 id 편집; 생성 title/template; rename title만; 삭제 확인; 재조회 | 제목 진입·field 연결 보강 |
| `/resumes/:id/edit` | 조회; 직렬 저장; basics 고정; current 종료 비활성; 목록 이동 전 저장 | 기존 경계 유지 |
| `/resumes/:id/edit` | 카드 펼침/접기·스크롤; 제목 오류; PDF 누락 포커스 | 이번 보강 |
| `/print/:id` | iframe 전용; 서버 저장본; 동일 renderer; 조회/렌더 오류 시 print 금지 | 기존 구현 유지; 사진 401 gap |

menu_path는 문서 OQ-UI-001의 정보구조 제안이다. 전역 3단 메뉴나 별도 관리자 화면을 만들지 않았다.
이력서 id, 항목 id, 소유자, 시각 등은 사용자 편집 필드로 추가하지 않았다.
기간·확정 상태 gate, current 해제 시 end 초기화 등 미정 정책도 추가하지 않았다.

## 보강 내역

### 1. 카드 제목으로 편집 진입

- 근거: ui-design.md:285, 7346의 선택 카드 id 기반 편집 진입.
- 변경: `frontend/src/pages/resumes/ResumeListPage.tsx`의 제목에 편집 Link를 제공한다.
- 썸네일 Link와 카드 메뉴는 유지한다. 메뉴 클릭을 편집 진입으로 처리하지 않는다.
- 생성은 응답 id, 기존 카드 진입은 해당 카드 id를 사용한다.

### 2. 섹션 카드 펼침/접기와 실제 미리보기 스크롤

- 근거: ui-design.md:267, 1983, 1987, 2010의 로컬 카드 접기·펼침·스크롤 계약.
- 변경: `frontend/src/pages/resumes/ResumeEditorPage.tsx`의 섹션 제목을 접근 가능한 버튼으로 전환한다.
- 접힘 상태는 로컬 UI 상태이며 content.hidden과 별개다. 접고 펼치는 동작으로 PUT하지 않는다.
- 접힌 입력 컴포넌트는 mounted 상태로 유지하여 작성 중인 태그와 업로드 상태를 보존한다.
- 펼침 스크롤은 `.resume-paper`의 해당 섹션을 사용한다.
  기존의 숨겨진 `.resume-measure`를 스크롤 대상으로 사용하지 않는다.
- PDF 누락 항목 선택은 접힌 소유 섹션과 대상 항목을 다시 열고 입력란에 포커스한다.
  누락 선택만으로 인쇄하지 않는다(ui-design.md:279, 7344).

### 3. 기존 단일 field 오류 연결

- 근거: ui-design.md:1489의 제목 입력 오류 연결 및 요청의 field-level 오류 표시 점검 기준.
- 현재 wire 계약은 `ApiError.fields` 배열이 아니라 `ApiError.field: string | null`이다.
  근거: backend common/ApiError.java:5–15 및 frontend api/apiClient.ts:6–12.
- 목록 생성/이름 변경은 오류 field가 title이면 제목,
  생성 오류 field가 template이면 템플릿에 aria-invalid/aria-describedby를 연결한다.
- field=null 또는 해석 불가능한 field는 공통 오류로 표시하고 임의 필드를 invalid로 만들지 않는다.
- 편집기 제목의 로컬 빈 값 및 서버 title 오류는 제목 입력과 연결한다.
  실패 시 제목 초안과 기존 저장 제목을 유지하며 성공 이동을 수행하지 않는다.
- backend 오류 envelope, 허용 field, 요청 DTO를 변경하지 않았다.
  PUT에는 여전히 template/style/content만, PATCH에는 title만 포함한다.

## 잔여 gap / 확인 필요

아래는 pipeline 실패 조건이 아니다. 사용자 범위를 지키기 위해 별도 기록한 미보강 항목이다.

1. 지정 이력서 글꼴 자원 공급 미보강
   - 계약: ui-design.md:7350의 Pretendard / Noto Serif KR 선택·출력.
   - ResumeRenderer.tsx:209–216은 family 이름을 지정한다.
     shared/styles.css:1–12와 public/fonts에는 앱용 Hanken Grotesk / Newsreader만 공급되어 있다.
   - 해당 이력서 글꼴이 환경에 설치되지 않으면 fallback이 사용된다.
     라이선스·배포 자원 공급 및 실제 출력 검증은 이번 최소 변경에 포함하지 않았다.

2. 사진 renderer 요청의 HTTP 401 관찰 미보강
   - 계약: ui-design.md:7342, 375의 사진 GET 401 → 로그인 경계.
   - ResumeRenderer.tsx:80–84는 직접 img src를 사용하여 HTTP status를 관찰하지 않는다.
     사진 decode 실패는 렌더 오류로 처리하지만 401인지 구분하지 못한다.
   - 이력서 GET 후 사진 요청 시 세션이 만료되는 경우,
     특히 인쇄 iframe에서 로그인 경계 전달이 누락될 수 있다.
   - print의 조회/렌더 오류 인쇄 차단은 유지한다.
     사진 로더·iframe 세션 전달을 함께 검증하는 별도 보강이 필요하다.

3. style.size ↔ pt 대응은 OQ-003 미해소
   - 계약: ui-design.md:298, 7350은 미승인 대응을 임의 확정하지 말 것을 명시한다.
   - ResumeRenderer.tsx:209 및 Editor의 옵션은 small/medium/large를 9/10/11pt로 대응시킨다.
   - 기존 대응을 다른 값으로 바꾸거나 완료된 계약으로 인증하지 않았다.
     승인된 매핑 근거가 필요하다.

4. 제목 변경 후 서버 GET 확인 미보강
   - 계약: ui-design.md:382, 7374는 제목 변경 성공 뒤 getResume 확인을 명시한다.
   - autosave.ts:74–84는 PATCH 성공 후 로컬 title을 갱신하며 별도 GET하지 않는다.
   - 단순 전체 GET 대입은 진행 중인 본문 입력을 덮어쓸 위험이 있다.
     제목만 동기화하는 방법과 PATCH 성공/GET 실패의 구분을 별도 테스트해야 한다.
     이번에는 제목 오류 표시만 보강했다.

5. 본문 구조 오류의 정확한 필드 경로 연결
   - ui-design.md:1988, 2049는 정확한 updateResume field 값에 OQ-011을 남긴다.
   - 현재 공통 wire는 단일 field이며 구조 오류를 자유롭게 여러 입력으로 매핑할 수 없다.
   - 지원하지 않는 `fields` 배열이나 추정 nested 경로를 꾸며내지 않았다.
     본문 저장 오류는 기존 저장 실패 상태·토스트로 유지한다.

6. 기존 미정 정책 유지
   - menu_path 실제 표시, 인증 route 재진입·세션 복구,
     current 해제 시 end 처리, 장문 pagination 등은 기존 OQ를 임의 해소하지 않았다.
   - frontend 저장 큐의 실패 제목 PATCH 재시도 정책도 이번 변경 범위 밖이다.

## 실행 검증

- 신규 회귀 테스트로 기존 누락을 먼저 재현했다.
  제목 진입, template 오류 연결, 편집기 제목 오류, 카드 접기, 접힌 PDF 필드 진입이 실패했다.
- 추가로 접기 후 미완성 태그 손실과 측정용 DOM 스크롤을 재현한 뒤 보강했다.
- `npm test -- --run src/pages/resumes/resumes.test.tsx`: 중간 단계 35개 통과.
- `npm run typecheck`: 통과.
- `npm test -- --run`: 9개 test file, 121개 test 모두 통과.
- `npm run build`: TypeScript 검사와 Vite production build 통과.
- React Router v7 future flag 안내 경고는 남아 있다. 테스트 실패는 없었다.
- 테스트는 기존 jsdom/HTTP test double 기반이다. 실 backend/DB·브라우저 출력 검증은 아니다.
- 앱을 띄운 e2e 실행은 수행하지 않았다. `frontend/tests/e2e`는 수정하지 않았다.
- `playwright install`은 실행하지 않았다.
- 수정한 소스/테스트의 120자 초과 줄과 trailing whitespace 검사 결과: 없음.

## 변경 파일

- frontend/src/pages/resumes/ResumeListPage.tsx
- frontend/src/pages/resumes/ResumeEditorPage.tsx
- frontend/src/pages/resumes/resumes.test.tsx
- frontend/evidence/ui-contract-drift-review.md

빌드 결과 `frontend/dist`는 재생성되었으며 커밋 대상에 추가하지 않았다.
