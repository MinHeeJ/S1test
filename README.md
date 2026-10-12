# ResumeCraft

Java 17 / Spring Boot 3.3.5 / Spring MVC / MyBatis XML / PostgreSQL 16,
React 18 / TypeScript / Vite 5 / npm 프로젝트입니다.

## 로컬 실행

`docker compose -f infra/docker-compose.yml up -d --build --wait`

frontend: http://localhost:3000, backend: http://localhost:8080/api/health.
DB는 host port를 공개하지 않습니다. nginx는 비특권 8080 포트에서 동작합니다.
Compose의 DB 연결 값은 비운영 개발용 기본값입니다. 운영에서는 DB_NAME, DB_USER,
DB_PASSWORD와 필요하면 FRONTEND_PORT/BACKEND_PORT를 외부 환경에서 재정의해야 합니다.
운영 비밀을 이미지나 저장소에 넣지 마세요.

npm lockfile은 npm이 생성한 package-lock.json만 사용합니다. 최초 생성 시 lockfile이
없으면 검증 단계에서 npm으로 materialize한 뒤 Docker build를 진행해야 합니다.
Docker build는 npm ci를 사용하며 임의 lockfile을 생성하지 않습니다.

## 공통 계약

- 실행 DDL은 Flyway V1/V2입니다. schema.sql은 동일 DDL snapshot이며 자동 실행하지 않습니다.
- users/resume ID는 BIGINT identity, photo ID는 앱 생성 UUID입니다. 이력서 wire ID는 문자열입니다.
- 공통 Java 타입은 com.resumecraft.common, SQL adapter는 common.persistence입니다.
  별도 SecurityConfig/HealthController/error advice를 중복 등록하지 마세요.
- ApiResponse.ok()는 data 없이 반환하고, ApiResponse.ok(T)는 약속된 data를 포함합니다.
  ApiException(HttpStatus, String code, String message, String field)은 안전한 업무 오류 전용입니다.
- SessionContext(SecurityContextRepository, CsrfTokenRepository)의 establish(Authentication,
  HttpServletRequest, HttpServletResponse)는 계정 검증/가입 commit 후 호출합니다.
  clear(HttpServletRequest, HttpServletResponse)는 현재 세션만 종료합니다.
- 로그인/가입/health만 공개입니다. POST login/signup도 CSRF가 필요합니다.
  GET /api/health의 meta.csrfToken과 meta.csrfHeaderName을 mutation header로 전송합니다.
  인증 후 다시 health로 bootstrap합니다. 소유 검사는 각 feature service가 담당합니다.
- UserMapper.insert(email, nickname, passwordHash), ResumeMapper.insert(userId, title,
  template, JsonNode style, JsonNode content)는 Long 생성 key를 반환합니다.
  ResumeMapper의 read/write는 userId + deleted=false를 검사하며 PUT adapter는 title을 수정하지 않습니다.
  PhotoMapper는 UUID와 원본 byte[]를 사용하고 사진 물리 삭제 operation은 제공하지 않습니다.
- frontend/src/shared/apiClient.ts는 상대 /api 요청, 세션 cookie, CSRF만 담당합니다.
  apiRequest<T>는 전체 envelope를 반환합니다. refreshCsrf()는 인증 후 재발급용입니다.
  401 이동과 미저장 안내는 편집/인증 단계가 상태에 맞게 처리합니다.
- AppShell은 children, nickname?, logout?를 받습니다. feature import를 하지 않습니다.
  제품 route 조립은 후속 단계가 담당하며 초기 entry는 실제 health 연결 상태만 표시합니다.
- domain/resume/types.ts의 nested property는 OpenAPI의 required 부재를 따라 optional입니다.
  serialization은 누락 필드, null, 순서와 입력 중 이메일/날짜 문자열을 보존합니다.

## 검증

runner 지정 명령: `python3 /app/infra/hermes/runner/parallel_self_check.py .`
API 추가 검증: 같은 명령에 `--api`를 붙입니다.

backend MockMvc 시험은 DB 없이 실행합니다. PostgreSQL mapper integration 시험은
TEST_DATABASE_URL이 있을 때만 실행하며 TEST_DATABASE_USER/TEST_DATABASE_PASSWORD를 함께 주입합니다.
무작위 독립 schema를 만들어 migration과 실제 JSONB/bytea round-trip을 검증한 뒤 제거합니다.
연결 정보가 없으면 시험은 명시적으로 skip합니다.

개발용 seed는 사용자 3명, 이력서 5건, 사진 0건입니다. 지우 입력은 완성도 계산 기준
90/90/0이며 DB에 점수나 페이지 수를 저장하지 않습니다. modern 본문의 정확한 2페이지 여부는
후속 공통 renderer와 폰트 로딩 후 실측해야 하며 foundation만으로 검증했다고 주장하지 않습니다.
