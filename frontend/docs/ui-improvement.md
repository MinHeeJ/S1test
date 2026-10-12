# UI 개선 계약 체크리스트

## 레퍼런스 직접 확인

Playwright 1.51.1과 설치된 Chromium headless shell로 https://rxresu.me/ 및
/auth/login, /auth/register에 직접 접속했다. 로그인 화면에서 가입 링크를 클릭하여
/auth/register로 실제 이동함을 확인했다. /dashboard는 인증 화면으로 이동하므로
로그인 후 목록·편집기의 실측 관찰은 불가능했다. 그 영역은 ui-style.md의 배포 소스 분석을 보조 근거로 사용한다.

실제 인증 화면: 따뜻한 off-white canvas, 가운데 352px 폼, 작은 브랜드, serif 제목,
36px 입력·버튼, 8px radius, white 입력, green primary, 회색 보조 문구.
홈페이지는 editorial serif 제목, 얇은 구분선, green CTA와 종이 기반 표현을 사용한다.
프로젝트에 없는 OAuth·AI·커리어·검색·추가 대시보드 기능은 복제하지 않는다.
목록·편집기의 기존 공통 헤더를 유지하며 별도 전역 sidebar를 만들지 않는다.

## 화면별 코딩 전 체크리스트

| 화면/route | 목적·archetype | CTA·필드·payload | 검증·성공·제약 |
| --- | --- | --- | --- |
| /signup | 가입 form | email, nickname, password, confirmation; POST /api/auth/signup에는 confirmation 제외 | 닉네임 2~12자, 비밀번호 8자 이상, 확인 일치; 서버 field 오류; 인증 성공 후 /resumes |
| /login | 인증 form | email/password → POST /api/auth/login; 가입 Link | 요청 중 중복 제출 차단; 실패 입력 유지; 세션·CSRF 유지; 성공 후 /resumes |
| /resumes | 문서 card library | GET /api/resumes의 title/updated_at/template/style/content; 첫 칸 생성; POST title/template; PATCH title; duplicate POST; 확인 후 DELETE | 서버 목록과 같은 renderer 썸네일; 최근 수정순·페이지 이동; 성공 refresh; 조회 오류/empty 구분; 대상 id 보존 |
| /resumes/:id/edit | 입력·A4 workspace | GET 대상; PUT template/style/content만; title은 PATCH만; 사진 multipart file → photoId; 로컬 section/item/style 편집 | 1.5초 직렬 저장; 실패 toast/retry; 목록 이동 전 저장; basics 고정·숨김/삭제 금지; hidden 내용 보존; current이면 end disabled; 링크 3/항목 20/태그 30 상한; warning 비차단 |
| /print/:id | readonly iframe | GET 저장본·사진; 동일 ResumeRenderer; window.print | 필수값 누락은 편집기에서 focus; 저장 성공·글꼴·사진 준비 후 출력; 별도 메뉴/팝업/API 없음 |
| / | 목록 별칭 | /resumes로 기존 Navigate | 미인증 401은 /login; 새 landing 없음 |

공통: loading/empty/error/success 및 401 로그인 이동, 404 대상 미제공.
삭제 확인은 이력서·섹션에만 사용하고 항목 삭제·사진 연결 해제는 즉시 적용한다.
메뉴 경로는 정보구조 분류이며 인증·편집·인쇄 route를 전역 메뉴로 노출하지 않는다.

## 구현 코드와 계약 정렬 근거

- ResumeController/ResumeService: page/size/filter, meta.totalPages/totalElements, 전체 본문 목록 응답.
- Resume DTO/type: 문자열 id, updated_at, camelCase nested content 및 photoId.
- PUT은 title/id/owner/timestamp를 제외하고 template/style/content만 전송한다.
- RenameResumeInput의 title만 PATCH; users/password_hash 등 서버 내부 필드는 UI에 노출하지 않는다.
- SignupInput은 email/nickname/password; 확인 비밀번호는 클라이언트에서만 비교한다.
- ApiError는 flat message/field 계약이다. 존재하지 않는 fields 배열을 발명하지 않는다.
- PhotoController는 multipart file 및 {photoId}; 사진 해제는 content의 null로 저장한다.
- 미확정 정책은 새로운 enum/route/데이터로 보충하지 않는다.

## 검증 결과

작업 완료 후 실제 실행 결과를 이 절에 기록한다.
