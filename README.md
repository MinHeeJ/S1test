# ResumeCraft

Java 17 / Spring Boot 3.3 / blocking MyBatis / PostgreSQL 16 / React 18 / Vite 5.

개발 실행: docker compose -f infra/docker-compose.yml up --build -d --wait
웹: http://localhost:3000, backend: http://localhost:8080/api/health
DB는 내부 네트워크만 사용합니다. DB_URL, DB_USER, DB_PASSWORD는 환경변수로 전달합니다.
Compose의 개발용 기본값은 운영에 사용하지 마세요. 운영에서 DB_PASSWORD와 계정, 포트 및 TLS를 반드시 재설정하세요.
Flyway V1은 users/resume/photo, V2는 사진 없는 합성 데모 데이터입니다.
운영 배포 전 데모 seed 사용 정책을 검토하세요.

frontend/package-lock.json은 runner self-check의 npm resolver가 생성한 lockfile입니다. 직접 작성하지 않았습니다.
재현 가능한 설치에는 npm ci를 사용하며 이 lockfile을 저장소에 포함합니다.
node_modules와 build 산출물은 gitignore/dockerignore로 제외합니다.

공통 Java API: ApiResponse.ok(), ApiResponse.of(T), ApiError.of(code, message, field),
ApiException(HttpStatus, code, message, field), SessionUser(UUID id, String email, String nickname).
인증 controller는 BCrypt 검증 또는 가입 commit 이후 SessionAuthentication.authenticate(SessionUser, request, response)를 호출합니다.
이 공통 component가 세션 id 교체, CSRF 토큰 초기화와 SecurityContextRepository 저장을 수행합니다.
Jackson JsonNode/UUID의 MyBatis 변환은 common.JsonNodeTypeHandler/common.UuidTypeHandler입니다.
XML mapper namespace는 각 기능의 mapper interface, mapper 리소스는 resources/mappers 아래에 둡니다.
UUID는 애플리케이션에서 발급하며 updated_at은 성공 쓰기 service transaction에서 갱신합니다.
사진 bytes는 JDBC/MyBatis byte[] 매핑을 사용합니다.

프론트 공통 transport: src/shared/http.ts request<T>(relativeApiPath, RequestInit).
mutation 전에 GET /api/health로 CSRF cookie를 준비하고 X-XSRF-TOKEN header로 전송합니다.
인증 기능은 가입/로그인 성공 뒤 토큰 갱신을 서버의 CSRF 인증 전략으로 처리해야 합니다.
이력서 wire types와 lossless serialization은 src/domain/resume에 있습니다.
라우트/렌더러 통합 소유자는 src/app/main.tsx를 최종 화면 진입으로 연결합니다.

DB 통합 테스트는 TEST_DB_URL, TEST_DB_USER, TEST_DB_PASSWORD가 있을 때만 실행됩니다.
독립 임시 schema를 생성하므로 시험 DB에서 schema 생성·삭제 권한이 필요합니다.
일반 MockMvc 테스트는 DB 없이 실제 SecurityConfig와 공통 advice를 사용합니다.
