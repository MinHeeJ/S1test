# ResumeCraft

Java 17 / Spring Boot 3.3 / MyBatis / Flyway / PostgreSQL 16 및 React 18 / Vite 5 기반입니다.

## 개발 실행

저장소 루트에서 `docker compose -f infra/docker-compose.yml up --build`를 실행합니다.
Frontend는 기본 3000, backend는 기본 8080 포트를 사용하며 PostgreSQL은 내부 네트워크에서만 접근합니다.
`GET /api/health`는 로그인 없이 `{"success":true,"meta":{}}`를 반환합니다.
프런트엔드의 `/api/` 요청은 nginx에서 backend로 전달합니다.

개발 기본값은 DB_NAME=resumecraft, DB_USER=resumecraft입니다. DB_PASSWORD는 Compose의 개발 전용 기본값을
사용합니다. 운영 배포에서는 DB_PASSWORD와 필요한 DB 설정을 환경변수로 반드시 재정의하고 HTTPS를 사용하세요.
이미지에 비밀 정보를 포함하지 않습니다. 로컬 데모 사용자 3명은 V2 migration에만 정의되어 있습니다.

## 공통 인터페이스

- `com.resumecraft.common`은 application bootstrap, 공개 health, 오류 envelope, 세션 principal과 보안을 제공합니다.
- `com.resumecraft.common.persistence`는 UserMapper, ResumeMapper, PhotoMapper 및 immutable row를 제공합니다.
  UUID는 java.util.UUID, JSON은 JsonNode, 시각은 OffsetDateTime이며 모든 row constructor는 선언 순서대로 받습니다.
  기존 이력서 읽기/수정은 user_id 및 deleted=false 조건을 포함합니다. 서비스가 transaction과 사진 소유 검증을 담당합니다.
- 가입/로그인 단계는 BCrypt PasswordEncoder bean을 사용하고 인증을 Spring Security 세션에 저장해야 합니다.
  `SessionUser(UUID id, String email, String nickname)`은 비밀번호 없는 공통 Principal입니다.
- 클라이언트는 먼저 `GET /api/auth/me`를 호출하고 응답의 X-CSRF-TOKEN 및 X-CSRF-HEADER를 읽습니다.
  비로그인 401에도 세션/CSRF token을 전달합니다. signup/login을 포함한 모든 변이에 해당 header와 cookie가 필요합니다.
- DB 초기화는 Flyway V1/V2만 수행합니다. schema.sql은 DDL reference이며 Spring SQL init은 비활성입니다.
- frontend/src/domain/resume은 8종 section 타입과 구조 전용 JSON 왕복 변환을 제공합니다.
  frontend/src/app/main.tsx의 mountApplication(application)은 최종 조립 단계가 실제 route tree와 연결합니다.
  이 prerequisite는 미구현 화면용 placeholder route를 등록하지 않습니다.

## 테스트 및 단계 경계

runner self-check: `python3 /app/infra/hermes/runner/parallel_self_check.py .`
API 확인: 같은 명령에 `--api`를 추가합니다.
외부 DB 없는 기본 테스트는 MVC/보안/오류 및 MyBatis 매핑/JSON 변환을 검사합니다.
실제 DB 테스트는 FOUNDATION_TEST_DB_URL이 있을 때만 활성화됩니다.
FOUNDATION_TEST_DB_USER 및 FOUNDATION_TEST_DB_PASSWORD로 opt-in DB 인증을 설정할 수 있습니다.
SQL 실행, 실제 API, 브라우저 및 2페이지 seed 렌더는 각각 별도의 실행 증거가 필요합니다.
이 단계에는 인증/이력서/사진 기능 controller나 최종 프런트 route 조립을 포함하지 않습니다.
