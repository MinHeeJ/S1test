# ResumeCraft 실행 설정

`docker compose -f infra/docker-compose.yml up --build -d --wait`

프론트엔드 http://localhost:3000, 백엔드 http://localhost:8081. PostgreSQL은 host port를 열지 않는다.
DB_NAME, DB_USER, DB_PASSWORD, FRONTEND_PORT, BACKEND_PORT에는 개발 기본값이 있다.
운영 배포에서는 DB 자격 증명과 포트를 반드시 override하고 TLS reverse proxy를 사용한다.
이미지에 비밀번호를 넣지 않으며 session cookie는 HttpOnly, SameSite=Lax이고 HTTPS에서는 Secure다.

스키마와 데모 본문은 Flyway V1/V2에서 적용한다. schema.sql은 동일한 DDL의 참조본이며 기동 시 실행하지 않는다.
users/resume/photo id는 UUID이고 애플리케이션이 발급한다. JSONB 및 bytea는 DB에 보관한다.

foundation 단독 인계는 완결된 앱이 아니다. GET /api/health는 runner 소유이고 업무 화면 및 route 등록은
후속 통합 소유다. frontend/src/app/main.tsx의 mountApplication(routes)를 실제 route 목록으로 호출한다.
의존성 lockfile은 npm이 생성한 package-lock.json만 사용하며, 없으면 검증 단계에서 materialize해야 한다.

실제 PostgreSQL JUnit 시험은 TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD가 있을 때만 실행한다.
격리된 전용 DB를 제공해야 하며 시험은 임시 schema 생성/제거로 production schema와 분리된다.
일반 MockMvc/unit 시험은 DB에 연결하지 않는다.
