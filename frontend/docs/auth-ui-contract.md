# 인증 UI 계약 체크리스트

## 근거 및 수정 범위

- 설계: `codegen-context/ui-design.md` 전역 계약(25–36, 64–90), 가입 계약(436–509), 로그인 계약(633–690).
- 구현 대조: `AppShell.tsx`, `router.tsx`, `authApi.ts`, `AuthController.java`, `SignupInput.java`, `LoginInput.java`.
- 수정 범위: 이 체크리스트와 `src/pages/auth/auth.css`, `LoginPage.tsx`, `SignupPage.tsx`만. 공통 app.css·라우터·백엔드·의존성은 변경하지 않는다.

## 필수 유지 사항

- [ ] 공개 `/login`, `/signup`과 기존 PublicAuthGuard/AppShell을 유지한다. 가짜 사용자·사이드바·마케팅 화면을 추가하지 않는다.
- [ ] 로그인은 이메일 → 마스킹 비밀번호 → 단일 로그인 버튼의 세로 폼이다. 가입은 이메일 → 닉네임 → 마스킹 비밀번호 → 비밀번호 확인 → 단일 가입 버튼이다.
- [ ] 초기 입력은 빈 값이며 seed 계정이나 비밀번호를 채우지 않는다.
- [ ] 로그인 payload는 `{ email, password }`, 가입 payload는 `{ email, nickname, password }`만 전송한다. 비밀번호 확인은 UI-only이다.
- [ ] 기존 가입 검증(이메일 정규식 및 trim, 코드포인트 기준 닉네임 2~12자·비밀번호 8자 이상, 확인 일치)을 유지한다. 가입 검증을 로그인에 확대하지 않는다.
- [ ] 기존 CSRF/session API client를 사용하고 mutation → 동일 세션 `me()` 성공 → `/resumes` 이동 순서를 유지한다. return URL·토큰 저장·새 endpoint를 추가하지 않는다.
- [ ] 요청 대기 중 폼과 입력을 유지하고 버튼을 비활성화한다. 기존 pending 문구와 중복 제출 차단을 유지한다.
- [ ] 로컬 가입 검증 실패는 제출하지 않는다. 서버/네트워크 실패는 성공 이동 없이 입력을 보존한다.
- [ ] 서버 message와 알려진 field의 오류 연결, 기존 하단 3초 토스트를 유지한다. 오류 field map·status·문구를 새로 발명하지 않는다.
- [ ] 소셜 로그인·비밀번호 재설정·취소·추가 확인 모달/CTA를 만들지 않는다. 기존 router의 계정 접근 링크는 외부 소유로 그대로 둔다.

## 시각·접근성 개선

- [ ] app.css의 warm-paper neutral/green token을 재사용한다. serif 제목, 절제된 카드 경계, 짧은 한국어 안내, 충분한 필드 간격과 전체 너비 CTA를 적용한다.
- [ ] 입력 label의 accessible name을 유지하고 오류·힌트를 label 밖에서 `aria-describedby`로 연결한다.
- [ ] 폼/section 제목 연결 및 필수 입력의 접근성 정보를 제공한다. 오류 발표는 기존 Toast alert와 충돌하지 않도록 로컬 가입 오류 영역만 polite live로 제공한다.
- [ ] 모바일·coarse pointer에서 44px 이상의 입력/제출 조작 높이, 줄바꿈, 가로 넘침 방지를 적용한다. 명확한 focus 및 invalid 상태를 유지한다.
- [ ] 실제 참조 실측은 이 하위 작업에서 수행하지 않았다. 승인된 warm-neutral/green 스타일 방향만 적용하며 외부 사이트의 관찰 사실로 주장하지 않는다.

## 검증 계획

추가 접근성 테스트는 허용 파일 경계를 지키기 위해 `/tmp/auth-ui-contract.test.tsx`에서 먼저 실패를 확인한 뒤 재실행한다. 기존 `AuthPages.test.tsx`, `router.test.tsx`, `AppShell.test.tsx`와 `npm run typecheck`를 실행한다. 브라우저 시각 검증 여부는 별도로 기록한다.

## 실행 결과

- 추가 접근성 테스트: 구현 전 폼 이름/로컬 오류 live 발표가 없어 3개 실패, 기존 로그인 field 연결 테스트 1개 통과. 구현 후 4개 모두 통과.
- 기존 인증·라우터·AppShell 테스트: 3개 파일, 35개 테스트 통과. React Router v7 future flag 안내만 발생.
- `npm run typecheck`: 통과.
- Playwright Chromium, `/login`·`/signup`, viewport 390px 및 1280px: 가로 넘침 없음, 입력/제출 버튼 모두 44px, serif 제목 font-family 확인. 가입 빈 제출 오류와 이메일 aria-invalid 연결 확인.
- 브라우저 검증은 anonymous 401 API 응답을 가로채어 수행한 UI 검사다. 실제 백엔드 end-to-end 인증 성공을 검증한 것으로 주장하지 않는다.
- 추가 테스트와 브라우저 스크립트/캡처는 `/tmp/auth-ui-*`에만 저장했다. 저장소의 테스트/공통 파일은 변경하지 않았다.
