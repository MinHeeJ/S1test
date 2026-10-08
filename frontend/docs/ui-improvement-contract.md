# UI 개선 계약 checklist

## 레퍼런스 직접 관찰

Playwright 1.51.1과 /opt/ms-playwright Chromium으로 https://rxresu.me/ 및
/auth/login에 접속했다. 공개 화면은 넓은 종이색 배경, serif 제목, green CTA,
얇은 neutral 경계, 흰 이력서 종이를 사용한다. 로그인은 가운데 좁은 세로 폼,
label/보조문구/입력/전체 너비 CTA의 계층을 사용한다. body computed style은
oklch(0.975 0.005 95), Hanken Grotesk Variable/system-ui다.
인증이 필요한 dashboard/builder의 실제 편집 조작은 관찰하지 않았으므로
ui-style.md의 소스 분석과 기존 제품 계약을 보조 근거로 사용한다.
외부 OAuth·ATS·휴지통·marketing 페이지는 제품 기능에 추가하지 않는다.

## 화면별 필수 계약 (코딩 전)

- /signup: 계정 가입 form. email/nickname/password/passwordConfirm 입력;
  확인 불일치·길이·형식·중복 이메일 오류 표시. 실제 SignupInput으로 POST 후
  /api/auth/me 세션 확인, /resumes 이동. 요청 중 중복 제출 차단.
- /login: 인증 form. email/password POST, 실패는 필드·토스트 및 현재 폼 유지;
  성공 세션 확인 후 /resumes. 신규 계정은 /signup 실제 Link.
- /resumes (이력서 / 내 이력서 / 목록): API-backed document grid, 2~4열,
  첫 생성 카드. 서버 title/template/content/style/updated_at 및 meta.total 표시.
  생성 POST {title,template} → 응답 id 편집 route;
  이름 변경 PATCH {title} → 목록 갱신; 복제 POST 선택 id → 목록 갱신;
  삭제 확인/취소 → DELETE 선택 id → 목록 갱신. 조회 오류와 쓰기 오류 구분,
  모달 field 오류·loading·empty·재시도·3초 토스트 제공.
- /resumes/:id/edit (이력서 / 작성 / 편집): 선택 id GET 기반 split editor.
  title PATCH와 PUT {template,style,content} 분리; id/updated_at/소유자는 불변.
  기본정보 고정·숨김/삭제 금지. 나머지 섹션 정렬/숨김/삭제 확인/종류별 추가;
  항목 복제/즉시 삭제/정렬, 날짜/이메일 경고는 자동저장을 차단하지 않는다.
  style의 기존 enum 유지. 사진 API 업로드 성공 photoId만 연결, 삭제는 null 연결 해제.
  1.5초 직렬 저장·실패 재시도·미저장 목록 이동 전 flush 유지.
  PDF 필수값 검사 → 누락 field focus 또는 flush → 숨긴 iframe.
  1024px 미만 입력/미리보기 전환; loading/error/404에 가짜 본문 금지.
- /print/:id (이력서 / 출력 / PDF 내보내기): iframe 전용 readonly GET,
  동일 ResumeRenderer 및 사진/폰트 준비 후 window.print. 별도 메뉴·팝업 금지.
- /: 기존 /resumes 별칭 유지. 새로운 sidebar/route/관리자 메뉴 없음.

## 코드/API 정렬 근거

ResumeController/ResumeService.Resume 및 resumesApi를 대조했다.
GET 목록은 data: Resume[], meta: {page,size,total}; detail은 data: Resume.
Resume = {id,title,template,style,content,updated_at}; 이름 변경은 PATCH,
PUT은 title을 포함하지 않는 기존 ResumeUpdate를 유지한다.
POST 생성/복제는 data.id다. ApiError는 현재 backend의 message/field를 기준으로 한다.
OpenAPI/data-model의 미해소 정책보다 실제 구현 shape를 우선한다.
사용자 nickname은 GET /api/auth/me, 사진 bytes는 GET /api/photos/{id}다.

## 구현 후 대조 및 실행 증거

실행 결과와 남은 제한은 ui-verification.md에 기록한다.
기존 5개 물리 route가 이미 구현되어 있어 신규 route 생성은 불필요하다.
