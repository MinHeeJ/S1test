# ResumeCraft 실행

저장소 루트에서 `docker compose -f infra/docker-compose.yml up -d --build --wait`로 실행합니다.
프론트엔드는 기본 3000, 백엔드는 8080 포트를 사용하며 DB는 호스트에 노출하지 않습니다.
`GET /api/health`는 nginx /api 프록시를 통해 세션 없이 200과 CSRF cookie를 제공합니다.
DB 연결은 DB_NAME, DB_USER, DB_PASSWORD 환경변수로 재정의합니다.
기본값은 개발 전용입니다. 운영에서는 비밀번호와 포트 등을 반드시 재정의하고 HTTPS를 사용하세요.
데모 계정/이력서는 합성 자료입니다. 운영 배포에서는 별도 승인된 seed 제외 정책이 필요합니다.

인증 컨트롤러는 SessionAuthenticationStrategy.onAuthentication 호출 후
SecurityContextRepository.saveContext로 세션을 저장하고 새 CSRF token을 발급해야 합니다.
프론트엔드는 health에서 XSRF-TOKEN cookie를 받아 변이 요청에 X-XSRF-TOKEN header를 보냅니다.

PostgreSQL round-trip 테스트는 TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD로 별도 테스트 DB에 연결합니다.
설정이 없으면 연결 전에 skip합니다. 테스트마다 임의 schema를 만들어 Flyway를 적용하고 종료 시 삭제합니다.
렌더러 소유 단계에서 seed의 완성도 90/90/0 및 modern 두 페이지를 검증해야 합니다.
