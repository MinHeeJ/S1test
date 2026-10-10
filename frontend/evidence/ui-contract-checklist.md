# UI 개선 체크리스트 (코딩 전)

## 직접 관찰
Playwright 1.51.1 / 설치된 Chromium으로 https://rxresu.me/, /auth/login, /dashboard 접속.
홈은 따뜻한 off-white 배경, serif 제목, 녹색 CTA, 종이 중심 미리보기.
인증은 카드 테두리 없이 중앙의 좁은 폼, 독립 로고, 넉넉한 여백, 8px input/button radius.
/dashboard는 로그인으로 redirect되어 인증된 목록/편집 화면을 실측하지 못함.
그 영역은 ui-style.md 보조 근거로 적용하며 관찰했다고 주장하지 않음.
소셜 로그인·AI·마케팅 샘플 데이터는 프로젝트 기능에 없으므로 복제하지 않음.

## 화면별 필수 계약
- /signup: registration form. email/nickname/password/confirmation. 확인은 로컬 전용.
  POST /api/auth/signup {email,nickname,password}. field 오류, 중복, busy, 세션 조회 실패 재시도.
  가입 성공 후 /resumes. 실제 /me는 nickname만 응답.
- /login: authentication form. POST /api/auth/login {email,password}.
  실패 유지/토스트, 성공 /resumes. 기존 router 유지. 복귀 URL 정책 추가 없음.
- /resumes: library. GET /api/resumes?page&size; data 배열, meta pagination.
  첫 카드 생성(title/template) POST → 응답 id 편집. PATCH 제목만, POST duplicate,
  DELETE 확인/취소 → 서버 목록 갱신. 썸네일 동일 renderer. loading/empty/error/retry.
  menu_path는 제안 정보구조이므로 전역 3단 sidebar 추가하지 않음.
- /resumes/:id/edit: content editor. GET 본인 이력서, PUT {template,style,content}; title 제외.
  제목 PATCH 전용. 1.5초 직렬 저장, 실패 retry, 목록 이동 전 flush.
  basics 고정, 사진 photoId만 변경, 숨김 데이터 보존, section 삭제 확인/항목 즉시 삭제.
  current 상태는 종료일 disabled. 필수 및 날짜 경고는 자동저장 차단에 쓰지 않음.
  PDF 필수값 검사→누락 필드 포커스 또는 flush→숨긴 /print/:id iframe.
  1024px 분할/그 미만 입력·미리보기 탭. 완성도·배율은 로컬 계산.
- /print/:id: iframe 전용. 서버 GET와 사진 준비 후 동일 renderer/window.print.
  메뉴/인쇄 팝업/서버 PDF endpoint 추가 없음. 실패 부모 통지, 종이 흰색/print CSS 보존.

## API 근거
backend auth AuthController/AuthService, resumes ResumeController/ResumeService/ResumeListResponse,
photos PhotoController와 frontend api.ts/authApi.ts/DTO를 대조.
본문 저장 필수값 검증을 임의 강화하거나 persistence/backend 계약 변경하지 않음.
미해소 OQ의 pt 매핑/장문 pagination/인증 재진입 정책은 이번에 새로 결정하지 않음.
