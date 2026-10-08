# UI Contract 느슨한 점검 및 보강 결과

## 범위와 판단 기준

`.aiops-spec/ui-design.md`의 route, 사용자 목적, CTA, Field Behavior, Action Mapping,
상태·검증·권한 계약을 현재 frontend와 대조했다. ASCII 위치·간격·컬럼 순서는
합격 조건으로 사용하지 않았다. 이 문서는 전체 제품 인수 완료 선언이나 pipeline 실패 게이트가 아니다.

기존 frontend 문서도 참고했지만, 그 문서의 구현 선택을 미해소 OQ의 승인으로 취급하지 않았다.
backend, persistence, OpenAPI, `tests/e2e` 및 dependency/lockfile은 수정하지 않았다.

## 화면별 계약 checklist와 관찰

| 화면 | 확인할 사용자 기능 계약 | 관찰 / 이번 처리 |
| --- | --- | --- |
| `/`, `/signup`, `/login` | 목록 별칭, 가입 확인 검증, 인증 성공 후 목록, 세션 확인, 입력 오류 | 기존 route·form·세션 확인 유지. 인증 정책 OQ는 아래에 기록 |
| `/resumes` | 첫 생성 CTA, `{title,template}` 생성과 새 id 이동, 카드 진입, 선택 id 이름 변경·복제·삭제 | 기존 기능 유지. 생성 template 오류 연결과 변이/재조회 결과 구분 보강 |
| `/resumes/:id/edit` | 실제 GET, title PATCH와 본문 PUT 분리, 불변 id, 편집·미리보기·저장 상태 | 제목 PATCH 후 GET으로 title만 확인. 로컬 본문·열린 항목·저장 큐는 유지 |
| 편집기 섹션/항목 | basics 고정, 숨김 데이터 보존, 섹션 삭제 확인, 항목 즉시 삭제, 개수 상한 | 기존 구현 유지. 전체 편집기 항목 단일 펼침과 카드 개수 표시는 미보강 gap |
| 편집기 필드 | current 종료 입력 disabled, 날짜/이메일 경고는 저장 비차단, 최대 링크·태그 | 기존 구현 유지. OpenAPI에 존재한다는 이유로 id/시각 등을 editable로 추가하지 않음 |
| 편집기 출력 CTA | 필수값 검사, 누락 field focus, 최신 저장 후 숨긴 iframe | 기존 흐름 유지. 인쇄 실패의 부모 알림은 미해소 gap |
| `/print/:id` | iframe 전용 readonly 서버 본문, 공유 renderer, 준비 완료 후 인쇄 | 기존 구현 유지. 새 메뉴·팝업·PDF API 없음 |

menu_path는 ui-design.md:104–109, 173–183의 정보구조 제안이므로 강제 3단 메뉴를 만들지 않았다.
이력서에는 기간 기반 접근 gate나 별도 role/lifecycle enum 계약이 없어 새 정책을 추가하지 않았다.

## 보강한 명백한 drift

1. 편집기 제목 변경 결과 확인 — US39-A03, ui-design.md:380–383, 7269–7296.
   - 기존에는 PATCH 후 입력 제목을 trim하여 저장 결과처럼 표시했다.
   - PATCH 성공 후 동일 id GET의 title만 반영한다. 서버 반환 전체 본문으로 현재 편집본을 덮어쓰지 않는다.
   - PATCH 실패와 PATCH 성공 뒤 조회 실패를 구분한다. 실패한 조회 때문에 PATCH를 자동 반복하지 않는다.
   - title 오류는 입력 아래 표시하고 `aria-invalid`/`aria-describedby`로 연결한다.
   - 제목 처리 중 `aria-busy`를 제공하고 동일 제목 저장·취소의 중복 조작을 제한한다.
     이는 로컬 보호이며 제목 PATCH와 본문 PUT/목록/PDF 사이의 경합 정책 승인으로 간주하지 않는다.

2. 목록 변이 성공과 결과 재조회 실패 구분 — ui-design.md:253–258.
   - 이름 변경·복제·삭제 후 목록 조회가 실패하면 작업 완료와 결과 확인 실패를 명시한다.
   - 목록 확인 실패 뒤 일반 성공 토스트를 덮어 표시하지 않는다.
   - 다시 시도는 GET만 재실행하며 변이 요청을 자동 반복하지 않는다. 현재 page/filter를 유지한다.

3. 생성 template 오류 연결.
   - 기존 title 오류 연결은 유지하고 실제 `ApiError.field === "template"`도 선택 입력에 연결한다.
   - 현재 apiClient와 backend 계약은 단일 `field`다. 다중 `fields` 배열이나 임의 경로 변환을 만들지 않았다.
   - 생성은 title/template, 제목 변경은 title, 본문 PUT은 template/style/content라는 기존 경계를 유지한다.

## 실행 증거

- 새 UI Contract 회귀 5개를 먼저 실행하여 5개 실패를 확인한 후 구현했다.
- 보강 후 같은 회귀 5개 통과.
- `npm run typecheck`: 통과.
- 전체 첫 실행: 103개 통과, router 단위 테스트 2개 실패.
  원인은 이미 중복 노출된 인증 링크를 단일 전역 selector로 선택한 것과 이전 사진 입력 라벨이었다.
  실제 계정 접근 navigation으로 조회 범위를 좁히고 현재 `사진 파일` 접근성 라벨로 정렬했다.
  실제 route 이동과 사진 입력 존재 assertion은 유지했고 테스트를 skip하지 않았다.
- 최종 `npm test -- --run --reporter=dot`: 8개 파일, 105개 테스트 모두 통과.
- 최종 `npm run build`: TypeScript와 Vite production build 통과, 72 modules transformed.
- React Router v7 future flag 경고는 남아 있다. 이번 점검에서 router 업그레이드는 하지 않았다.
- 브라우저 실앱/E2E는 실행하지 않았다. `tests/e2e`는 변경하지 않았으며 `playwright install`도 실행하지 않았다.
  route 테스트는 jsdom에서 실제 등록 route와 API transport를 실행한 것이며 브라우저 검증으로 표현하지 않는다.

## 남은 gap — 실패 게이트 아님

### 명세/API 미해소 정책

- OQ-003: small/medium/large와 9/10/11pt 대응의 승인 근거가 미해소다.
  기존 UI와 renderer 매핑을 유지했지만 그것을 명세 승인 완료로 판정하지 않는다.
- OQ-002: 긴 항목 분할 및 modern 다중 페이지 연속 정책이 미해소다.
  기존 문자 단위 분할을 임의 재작성하지 않았다.
- OQ-UI-002 / OQ-UI-301 / OQ-UI-039-01·02:
  인증 route 재진입, 미저장 만료 안내·복구, 로그아웃 저장 연계, 제목 확정 이벤트와
  PATCH/PUT/목록/PDF 경합 정책의 명세 승인 근거가 미해소다. 기존 정책은 유지했다.
- ApiError는 현재 단일 field다. 다중 `fields`나 모든 content 경로별 서버 오류를 연결하려면
  실제 서버 경로 계약을 먼저 확인해야 한다. 모르는 경로는 일반 오류로 유지한다.

### 관찰한 미보강 기능 drift / 후속 검토

- `ResumeRenderer.tsx`의 경력·프로젝트 설명은 일반 `<p>` 문자열로 출력된다.
  `- ` 줄의 의미적 글머리표 렌더링 계약(US28/US31)은 남아 있다.
  현재 페이지 분할 측정이 `<p>`에 직접 의존하므로 이번 제목·오류 보강과 분리하여
  pagination/print 회귀를 동반한 후속 수정 대상으로 기록한다.
- `SectionFields.tsx`는 섹션별 openItem을 유지한다. 섹션 안에서는 단일 펼침이지만
  여러 섹션을 가로지르는 단일 펼침 계약(REQ-067)은 아직 충족하지 않는다.
  편집기 섹션 summary의 항목 수 표시(REQ-066)도 없다.
- 미리보기 최초 zoom은 고정 0.6이고 맞춤 버튼만 너비를 계산한다.
  초기 맞춤 모드/선택 배율 표시(US26) 및 반응형 실브라우저 결과는 후속 검토가 필요하다.
- A4 renderer의 사진은 직접 `<img src="/api/photos/...">`다.
  PhotoImage/photosApi와 달리 사진 요청 자체의 401 상태를 해석하지 않는다.
  이미지 실패를 알리지 않는 preview/thumbnail 경계와 사진-only 세션 만료를 검토해야 한다.
- `PrintPage.tsx`의 조회·사진 실패 안내는 숨긴 iframe 내부에만 있다.
  부모 편집기에 실패 전달·재시도·iframe 정리 UX는 OQ-UI-1203·1204와 함께 확인해야 한다.
- 초기 GET 404는 편집을 막지만 열린 편집기에서 쓰기가 404를 받으면 현재는 오류만 표시한다.
  삭제/접근 상실 후 편집 차단 전환은 기존 데이터 보존과 함께 별도 검토가 필요하다.

위 항목의 API나 승인 정책을 꾸며내거나 backend 계약을 확장하지 않았다.

## 이번 변경 파일

- `frontend/src/pages/resumes/ResumeEditorLoader.tsx`
- `frontend/src/pages/resumes/ResumeListPage.tsx`
- `frontend/src/pages/resumes/ResumePages.test.tsx`
- `frontend/src/app/router.test.tsx`
- `frontend/docs/ui-contract-review.md`

빌드는 ignored `frontend/dist/` 산출물을 갱신했다. source 변경 목록과 구분한다.
작업 시작 시 frontend/backend/infra 자체가 Git untracked 상태였으므로
`git diff`만으로 이번 변경 범위를 판정하지 않는다. 다른 기존 파일은 수정하지 않았다.
