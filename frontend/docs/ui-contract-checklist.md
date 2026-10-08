# UI 개선 계약 체크리스트

## 레퍼런스 직접 관찰

Playwright 1.51.1과 설치된 Chromium으로 https://rxresu.me/, /auth/login,
/auth/register에 직접 접속했다. /dashboard/는 /auth/login으로 redirect되어
인증된 dashboard/builder의 실측은 불가했다. 이 영역은 ui-style.md의 배포 소스 분석을 보조로 사용한다.
실제 확인: 따뜻한 neutral 배경, serif 제목과 sans 본문 대비, 녹색 CTA,
중앙 좁은 인증 폼, 테두리 없는 콘텐츠 영역, 둥근 입력, 회원가입/로그인 상호 링크.
레퍼런스의 OAuth·비밀번호 복구·공개 landing은 현재 backend 계약에 없어 추가하지 않는다.
기존 sidebar는 유지하며 신규 대시보드/관리자 메뉴는 만들지 않는다.

## 화면별 기능 체크리스트

| route / 메뉴 맥락 | 목적·형태 | CTA / API | 필드·payload | 검증·상태·성공·제약 |
| --- | --- | --- | --- | --- |
| /signup / 접근·계정·회원가입 | 가입 폼 | POST /api/auth/signup | email/nickname/password만 전송; confirmation 로컬 비교 | nickname 2~12, password 8+, 중복/field 오류, busy, 성공 자동 로그인 /resumes |
| /login / 접근·계정·로그인 | 인증 폼 | POST /api/auth/login | email/password; 세션 cookie, CSRF bootstrap | 오류 유지, busy, 성공 /resumes; 가입 route 링크 |
| /resumes / 이력서·내 이력서·목록 | 자기 이력서 카드 목록 | GET /api/resumes; POST 생성; PATCH 이름; POST duplicate; DELETE | 실제 ResumeView: id/title/template/style/content/updated_at; filter/page/size | loading skeleton, 조회 오류와 empty 분리, 재시도, 첫 생성 카드, 대상 id 유지, 삭제 확인, 저장 후 refresh |
| /resumes/:id/edit / 이력서·작성·편집 | 입력+A4 작업 공간 | GET 대상; PUT 자동저장; PATCH 제목; POST /api/photos | PUT은 template/style/content만; title PATCH 분리; owner/id/updated_at 수정 금지 | 직렬 1.5초 저장, 실패 재시도, 이동 전 flush, PDF 누락 검사, beforeunload, 401/404 경계 |
| /print/:id / 이력서·출력·PDF 내보내기 | iframe readonly 인쇄 | GET 대상/사진, window.print | 서버 저장본, 동일 ResumeRenderer | 선행 필수 검사·flush 성공 후 출력; 직접 메뉴 없음; 실패 시 인쇄 중단 |

## 편집기 세부 계약

- 1024px 이상 입력/미리보기 분할; 미만 입력/미리보기 탭.
- 템플릿·스타일은 입력 패널을 교체하며 route/content를 보존.
- basics 고정, 숨김/삭제/이동 금지. 다른 섹션 펼침/접기, 항목 수, 숨김/삭제 확인/드래그.
- 숨김은 데이터 유지, 출력/필수 검사/완성도 제외.
- 항목 단일 펼침, 즉시 삭제, 복제/추가 20개 상한; skills 30개, links 3개.
- current=true 종료란 disabled; 날짜·이메일 경고는 저장 비차단.
- 사진 업로드 실패 기존 연결 유지, 삭제는 photoId=null 연결 해제.
- 완성도 50/10/20/10/10 계산, 빨강/주황/초록 막대 및 부족 기준.
- PDF 누락 항목 클릭 시 설정·접힌 섹션·항목을 열고 실제 필드에 focus.
- 줌은 로컬 50~150%와 맞춤. 조회 실패를 빈 본문으로 만들지 않는다.

## 구현 데이터 정본

ResumeController/ResumeService/ResumeView와 기존 client를 함께 확인했다.
목록 API가 content/style 포함 본문을 반환하므로 thumbnail을 가짜 이미지로 대체하지 않는다.
backend ApiError는 fields 배열이 아니라 단일 field를 반환한다. 실제 field/message로 피드백한다.
OpenAPI 및 data-model은 보조 계약이며 size enum small/medium/large 유지; 미확정 pt 매핑은 추가하지 않는다.
backend persistence/DDL은 수정하지 않는다.
