# UI Contract 느슨한 점검 결과

## 범위와 판단 기준

`.aiops-spec/ui-design.md`와 현재 `frontend/src`를 비교했다.
ASCII 위치·간격·컴포넌트 배치·컬럼 순서는 합격 조건으로 사용하지 않았다.
명백한 사용자 기능 누락만 보강했으며 backend/API/persistence와 tests/e2e는 수정하지 않았다.
아래는 전체 명세 준수 인증이나 pipeline 실패 판정이 아닌 보강 결과와 남은 gap이다.

## 화면별 계약 체크리스트 및 구현 매핑

| 화면 | 계약·실제 영역 | 점검 결과 |
| --- | --- | --- |
| /signup | 접근 / 계정 / 회원가입; 가입 폼 | 인증 API, 길이·confirmation 검증, field 오류, busy, 성공 /resumes |
| /login | 접근 / 계정 / 로그인; 인증 폼 및 가입 링크 | email/password 전송, 오류·busy, 성공 /resumes 흐름 존재 |
| /resumes | 이력서 / 내 이력서 / 목록; 카드·작업 메뉴·모달 | 생성의 응답 id 이동, 이름 변경 재조회, 삭제 확인·취소, 복제·재조회, loading/empty/error/401 처리 존재 |
| /resumes/:id/edit | 이력서 / 작성 / 편집; 입력/설정·A4 | title PATCH/본문 PUT 분리, flush·실패 이동 차단, PDF 누락 포커스, 항목 편집 |
| /print/:id | 이력서 / 출력 / PDF 내보내기; iframe readonly | 저장본 GET, 동일 ResumeRenderer, 사진·글꼴 준비 대기, 인쇄 실패 중단 존재 |
| / | /resumes 별칭 | 독립 landing 없이 목록으로 연결 |

menu_path는 명세 OQ-UI-001의 정보구조 제안이다. 이를 근거로 신규 메뉴를 추가하지 않았다.
각 화면의 위치를 재배치하거나 기존 sidebar를 전역 헤더로 다시 작성하지 않았다.

공통 점검:
- id/owner/시각을 사용자 편집란으로 만들지 않았고 photoId는 업로드·해제 결과만 연결한다.
- 생성 title/template과 이름 변경 title-only payload를 구분한다.
- 본문 PUT은 template/style/content만 유지한다. lifecycle/ownership 필드를 추가하지 않았다.
- basics는 이동·숨김·삭제 불가, current=true의 종료 입력은 disabled다.
- 숨긴 섹션은 데이터 유지 및 출력·필수 검사·완성도 제외로 구현되어 있다.
- 필수값은 완성도/PDF 검사에만 적용하고 날짜·이메일 경고는 자동저장을 차단하지 않는다.
- 항목·태그·링크 상한, 섹션 삭제 확인, 항목 즉시 삭제, 사진 실패 시 이전 연결 유지가 존재한다.
- 서버 session/소유 경계를 대체할 role enum, 임의 기간 gate, 확정 상태를 추가하지 않았다.

## 이번 보강

1. 접힌 항목 요약: 첫 필드·둘째 필드·기간 표시.
   근거: ui-design.md:1911, REQ-067.
   current=true는 이전 end 대신 현재로 표시한다. 자격증은 취득일, 어학은 시험명을 표시한다.
   첫 필드가 비면 `(제목 없음)`을 유지하며 펼침·항목 id·저장 payload는 변경하지 않는다.

2. 기본정보와 항목 첫 필드의 필수 표시.
   근거: ui-design.md:6909–6911, :7363–7368, :7372.
   시각적 `(필수)` 및 aria-required를 제공한다. HTML required 검증을 추가하지 않아 자동저장은 비차단이다.

3. 편집기 제목 변경 결과 동기화 및 오류 피드백.
   근거: ui-design.md:7269–7287.
   PATCH 후 GET의 title을 표시하고 서버 본문 전체로 현재 입력을 덮어쓰지 않는다.
   처리 중 표시, 제목 입력·제출 비활성화, title 필드 오류와 입력·기존 제목 보존을 보강했다.
   PATCH 실패와 PATCH 성공 후 재조회 실패를 구별하며 제목 성공 토스트를 제공한다.
   기존 제목 편집 모달과 flush 순서를 유지했다. 이를 미확정 상호작용 정책의 승인으로 취급하지 않는다.

4. 인쇄 document.title을 `이름_희망직무_이력서`로 변경.
   근거: ui-design.md:2584, REQ-110.
   resume.title이 아니라 저장된 basics.name/jobTitle을 사용한다.

## 남은 gap 및 확인 필요

- 글꼴 리소스: ResumeRenderer는 Pretendard/Noto Serif KR family를 선택하지만
  제공된 public/fonts와 @font-face는 Hanken Grotesk/Newsreader뿐이다.
  사용자 OS에 해당 이력서 글꼴이 없으면 fallback이 발생한다. 라이선스·리소스 제공 방식 및
  글꼴 로딩 후 페이지 재측정까지 별도 보강이 필요하다(ui-design.md:3346, :3377, :7423).
- 크기 매핑: 기존 renderer는 small/medium/large를 9/10/11pt로 고정한다.
  명세는 이 매핑을 OQ-003으로 남겼다(:3315, :3322, :3387). 임의 대체 매핑은 추가하지 않았다.
- 제목 정책: 생성 빈 제목·trim·최대 길이는 OQ-UI-050, 이름 변경 공백 정책은 OQ-004다.
  현재 생성·이름 변경의 trim 기반 빈값 차단은 기존 동작으로 유지했다.
  backend와의 조정 없이 임의 완화·새 길이 제한을 적용하지 않았다.
- 제목 확정 이벤트·진행 중 취소/이동·본문 PUT과 PATCH 조정은 OQ-UI-039-01/02다.
  기존 모달·flush를 보존했으며 제목 요청까지 모든 이동 경로를 직렬화하는 재작성은 하지 않았다.
- ApiError는 실제 backend/common/ApiError.java에서 단일 `field`를 반환한다.
  명세도 구체 경로를 OQ-011로 남긴다. 가상의 `fields` map을 생성하지 않았다.
  auth의 연결 가능한 필드 및 이번 title 오류는 입력에 연결되지만 본문 저장의
  nested content 경로·복수 필드 오류는 실제 API 매핑 승인 전 gap으로 남긴다.
  목록 모달의 일반 서버 오류도 제목 필드 오류로 세분되지 않는 경우가 있다.
- 필드 존재 규칙(OQ-018), 신규 항목 id/초기값(OQ-008), 링크 증감 UX(OQ-UI-3701),
  태그 정규화·문자 수 계산·자기소개 공백 계산 정책은 미확정 항목이다.
  현재 구현 선택을 새로운 승인 계약으로 간주하거나 임의 변경하지 않았다.
- 로그인 후 원래 경로 복귀·세션 복구는 미확정이다. 브라우저 저장소 보존 경로를 추가하지 않았다.

## 검증 증거

- 변경 전 `npm test -- --run src/pages/resumes/ResumePages.test.tsx`:
  추가·강화한 계약 검증 6개 실패, 기존 23개 통과. 누락 때문에 실패함을 확인했다.
- 변경 후 같은 명령: 29개 통과.
- `npm test -- --run`: 6개 파일, 99개 테스트 통과.
- `npm run build`: TypeScript 검사 및 Vite production build 통과.
- React Router v7 future flag 경고는 기존 테스트에서도 출력되며 테스트 실패는 아니다.
- 설치된 Chromium과 Vite preview(127.0.0.1:4187)로 `/login`, `/signup` 실제 제목을 확인했다.
  `/resumes`, `/resumes/contract-check/edit`, `/print/contract-check`는 404 대신
  세션 확인 실패 UI를 렌더했고 `/`는 `/resumes`로 연결되었다.
  실제 backend 세션이 없는 preview이므로 로그인된 보호 화면·저장·인쇄 E2E 성공을 주장하지 않는다.
  보호 화면 계약은 component 및 기존 route 테스트로 검증했다.
- tests/e2e는 수정·실행하지 않았다. playwright install은 실행하지 않았다.
