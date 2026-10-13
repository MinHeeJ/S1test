# UI Contract 느슨한 점검 결과

## 범위와 판단 기준

`.aiops-spec/ui-design.md`의 Screen Inventory, Screen Action Mapping, 기능별 데이터 바인딩,
상태, 최종 화면 계약과 현재 frontend 구현을 정적으로 비교했다.
ASCII 위치·간격·컴포넌트 배치·컬럼 순서는 합격 조건으로 사용하지 않았다.
전체 요구의 인수 완료 판정이나 pipeline 실패용 검증은 아니다.
backend, persistence, API schema, tests/e2e는 변경하지 않았다.

## 화면별 계약 체크리스트와 현재 구현

- `/login`: 이메일·비밀번호 제출 → login → 현재 사용자 확인 → `/resumes`.
  실패 시 이동하지 않으며 오류를 표시한다. 비밀번호는 마스킹한다.
- `/signup`: email/nickname/password 제출; confirmation은 로컬 검사 후 payload 제외.
  닉네임·비밀번호 길이 및 확인 불일치 검증, 단일 field 서버 오류 표시,
  가입 성공과 후속 세션 확인 실패를 구분한다. 별도 login 제출을 요구하지 않는다.
- `/resumes`: 실제 목록 카드·빈 상태·조회 오류, 생성 모달의 title/template,
  응답 id 편집기 이동, 선택 id 이름 변경·복제·삭제 및 성공 후 재조회가 있다.
  삭제 확인의 제목은 readonly이고 취소는 DELETE를 호출하지 않는다.
  닉네임·수정 시간·썸네일은 표시 자료이며 소유자·삭제 상태 입력을 만들지 않는다.
- `/resumes/:id/edit`: 실제 상세 → 본문·설정 실시간 렌더 → 직렬 자동저장.
  basics 이동·숨김·삭제 금지, 항목·태그·링크 상한, current 종료일 disabled,
  날짜·이메일 경고와 입력 보존, 저장 실패 재시도 및 저장 후 목록 이동이 있다.
  PUT은 title/template/style/content만 사용하고 id/updated_at·완성도·줌·페이지 수는 제외한다.
  사진은 서버 반환 photoId 연결·교체 또는 null 연결 해제로 처리한다.
  PDF는 필수 검사 → 필요한 최신 저장 → 숨긴 iframe 순서이다.
- `/print/:id`: 서버 저장 자료와 같은 ResumeRenderer를 사용하고 shell을 출력하지 않는다.
  렌더·폰트·사진 준비 후 인쇄하며 조회 실패 시 인쇄하지 않는다.
- route 및 기존 진입 방식은 유지했다. menu_path는 설계 분류안이므로 별도 상시 메뉴를 추가하지 않았다.
  원문에 없는 role·기간·확정 상태 gate도 추가하지 않았다.

위 내용은 소스 점검과 기존 frontend 테스트의 관찰 범위이며, 실제 서버·DB 인수 완료 주장이 아니다.

## 보강한 명백한 drift

1. 삭제 명령 성공 뒤 목록 갱신 실패 시 삭제 카드가 남는 문제.
   - 근거: US07-D4/D5 및 ui-design.md:1952의 성공한 삭제를 되돌리지 않는 계약.
   - 서버 DELETE 성공으로 확인된 id만 즉시 제거하고 재조회 오류는 별도로 표시한다.
   - 다른 카드는 유지하며 다시 조회는 GET만 수행한다. DELETE를 재실행하지 않는다.
2. 이름 변경·복제·삭제의 404 이후 오래된 카드/조작 문맥이 노출되는 문제.
   - 근거: F06-A3, ACT-US06-DUPLICATE, US07-D4 및 각 permission 상태.
   - 404인 대상 id만 제거하고 그 대상의 메뉴·이름 변경 입력·삭제 모달을 닫는다.
   - 다른 대상은 유지하고 원래 오류 토스트를 표시한다. 다른 실패의 재시도 문맥은 유지한다.
3. 편집기 요청 id와 상세 응답 id의 불일치를 허용하는 문제.
   - 근거: ui-design.md:1340, 2954의 선택 id·응답 id 일치 계약.
   - 불일치 응답은 계약 오류로 처리하여 제목·본문·사진·미리보기를 표시하거나 저장하지 않는다.

## 남은 gap과 미확인 경계

- OQ-008: 기존 UI와 renderer는 small/medium/large를 9/10/11pt에 대응시킨다.
  API enum은 있지만 실제 승인된 pt 대응 증거는 확인되지 않았다.
  이번 최소 보강에서는 이 기존 대응을 변경하지 않았으며 pt 계약 완료로 판정하지 않는다.
- OQ-UI-004: 기존 AppShell은 미저장 편집기의 logout 전에 flush한다.
  이는 구현 선택이고 문서에서 저장·세션 종료 순서를 승인한 증거는 아니다. 정책 변경은 보류한다.
- 생성 title의 빈값·공백 검증: UI가 현재 nonblank 검사로 막고 서버도 title을 검증한다.
  UI 문서의 OQ-003은 생성 title 정책을 미확정으로 두므로 현행 동작을 승인으로 간주하지 않는다.
- ApiError는 현재 API/프론트 계약에서 `field: string | null`이다.
  `fields` 배열/맵을 발명하지 않았다. 생성 모달은 template 오류도 공통 메시지로 표시하므로
  title/template별 접근성 연결 강화는 남아 있다. 오류 envelope 승인 경계 OQ-009도 유지한다.
- 편집 중 saveResume/renameResume의 404는 현재 저장 실패/토스트로 처리하며
  초기 GET 거부와 달리 기존 편집 자료를 제거하는 처리는 부족하다.
  직렬 저장 조정기와 로컬 입력 보존 경계가 함께 관련되므로 이번 작은 목록 보강에서는 변경하지 않았다.
- 사진 표시 일부는 직접 img URL을 사용한다. 이미지 GET 401을 공통 JSON API handler처럼
  로그인 이동으로 전달하는 처리는 이번에 확인·보강하지 않았다.
- OQ-002 페이지 분할, 사진 복제·보관, 출력 실패 전달·취소 등 문서의 미확정 상세는 해결하지 않는다.

## 실제 실행 결과

- 수정 전 회귀 테스트: screens.test.tsx에서 새 사례 5개 실패, 기존 24개 통과.
  삭제 카드 잔존, 3종 명령의 404 문맥 잔존, 다른 id 응답 표시를 확인했다.
- 수정 후 `npm test -- --run src/pages/resumes/screens.test.tsx`: 29개 통과.
- 최종 `npm test -- --run`: 11개 파일, 113개 테스트 통과.
- 최종 `npm run build`: TypeScript 검사 및 Vite production build 통과.
- 기존 React Router future flag 경고는 남아 있다.
- tests/e2e는 수정하거나 실행하지 않았다. 브라우저 설치 명령도 실행하지 않았다.
  이번 검증은 Vitest/jsdom과 production build이며 실제 브라우저·DB-backed E2E 검증은 아니다.

## 변경 파일

- frontend/src/pages/resumes/SC-RESUMES.tsx
- frontend/src/pages/resumes/SC-EDITOR.tsx
- frontend/src/pages/resumes/screens.test.tsx
- frontend/UI-CONTRACT-REVIEW.md

빌드로 frontend/dist가 재생성되었으며 소스 변경 목록에는 포함하지 않는다.
