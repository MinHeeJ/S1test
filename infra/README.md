# 로컬 실행

최종 병합 및 npm lockfile 물리화 후 저장소 루트에서 실행합니다.

    docker compose -f infra/docker-compose.yml up -d --build --wait

프론트 기본 포트는 3000, 백엔드는 8080입니다. DB는 호스트에 노출하지 않습니다.
nginx는 비특권 사용자로 컨테이너 8080에서 동작합니다.
DB_NAME, DB_USER, DB_PASSWORD, FRONTEND_PORT, BACKEND_PORT에는 개발 기본값이 있습니다.
운영에서는 DB_PASSWORD를 반드시 외부 환경으로 재정의하고 HTTPS 및
SESSION_COOKIE_SECURE=true를 적용합니다. 이미지에는 자격 증명을 넣지 않습니다.

frontend/package-lock.json은 npm으로 물리화해야 합니다. codegen에서 lockfile을
수기로 만들거나 package manager를 실행하지 않았습니다. Docker의 npm ci는 이
lockfile을 요구합니다. 각 feature slice 화면은 createAppRouter(routes)에 등록하며,
GET /api/health는 별도 runner 소유입니다. foundation 단독 UI는 완성 제품 화면이 아닙니다.

PostgreSQL 통합 시험은 TEST_DATABASE_URL, TEST_DATABASE_USER,
TEST_DATABASE_PASSWORD가 있을 때만 실제 DB에서 실행합니다. 폐기 가능한 DB를 사용합니다.
