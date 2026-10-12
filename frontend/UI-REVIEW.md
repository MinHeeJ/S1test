# UI 개선 계약 체크리스트

## 구현 전 확인

- `/login`: 중앙 인증 폼, email/password 제출 → login → me 확인 → `/resumes`.
  기존 인증 이동 링크 유지. 오류·중복 제출 억제·마스킹 유지.
- `/signup`: email/nickname/password/confirmation, 확인값은 로컬 전용.
  2~12자 nickname, 8자 이상 password, 확인 일치, 서버 field 오류.
  signup 성공 후 me 확인·자동 이동; 인증 확인 실패 시 가입 재POST 금지.
- `/resumes`: 본인 GET 목록·최근 수정순·첫 페이지 썸네일·title/updated_at.
  첫 칸 생성 모달 `{title,template}` → 응답 id 편집 route.
  카드 메뉴 이름 PATCH/복제 POST/삭제 확인 DELETE → 목록 재조회.
  대상 id 유지, 삭제 취소 무요청, 오류/빈 결과 구분, 재조회 실패와 명령 성공 구분.
- `/resumes/:id/edit`: GET 자료로 필드/사진/미리보기 바인딩.
  PUT은 `{title,template,style,content}`만, id/updated_at/zoom/완성도 제외.
  1.5초 직렬 저장·retry·목록/로고 이동 전 flush·실패 시 머무름.
  basics 고정/비숨김/비삭제; 종류 중복 금지·항목 20개·태그 30개.
  current 종료 입력 비활성, 숨김 자료 보존·출력 제외. 날짜 경고는 저장 차단 아님.
  설정은 본문 입력을 대체; 설정 변경 시 content 유지·같은 저장 조정기 사용.
  사진 multipart 업로드 반환 photoId 연결; 삭제는 null 저장, 물리 DELETE 없음.
  1024px 이상 분할, 미만 입력/미리보기 탭.
- `/print/:id`: PDF 필수검사 → 누락 필드 이동 또는 최신 flush → 숨긴 iframe.
  저장 자료 GET·같은 Renderer·이미지/글꼴 준비 → print, 오류 시 무인쇄.
  출력에 shell/toast 제외, A4/흰 종이/기존 템플릿 유지. 신규 일반 메뉴 없음.

## 실제 레퍼런스 관찰

설치된 Playwright 1.51.1 Chromium으로 `https://rxresu.me/`, `/auth/login`,
`/dashboard`를 직접 방문하고 스크린샷·DOM·computed style을 확인했다.
홈은 고정 공개 내비게이션과 serif 스토리 섹션이며 제품 목록과 혼동하지 않는다.
인증 화면은 따뜻한 종이 배경 위 중앙 352px 폼, 카드 테두리 없는 구성,
serif 제목, 녹색 CTA, 얇은 neutral input 경계다. 공개 폼의 focus와 검증을 확인한다.
`/dashboard`는 로그인으로 redirect되므로 인증 후 목록/편집기를 실제 관찰했다고 주장하지 않는다.
인증 후 화면의 세부 스타일은 ui-style.md의 배포 코드 분석을 보조 근거로 사용한다.
소셜 인증/지원 관리/AI 기능/다른 템플릿을 제품에 추가하지 않는다.
기존 sidebar/React Router/React+CSS 시스템 유지, 신규 UI 라이브러리 없음.

## 미확정 계약 보존

기존 size→pt 대응·사진 복제·로그아웃 flush·인증 직접 접근 정책은 변경하지 않는다.
승인 문서의 OQ를 이 작업으로 해결했다고 주장하지 않는다.
검증 결과와 변경 파일은 작업 완료 시 기록한다.
