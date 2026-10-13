# 로컬 실행

Node 20 / npm 10 환경에서 frontend/package-lock.json을 npm으로 materialize한 뒤 실행한다.
lockfile은 codegen에서 직접 작성하지 않는다. compose의 기본 DB 이름/계정은 resumecraft이며,
비밀번호는 첫 실행에서 무작위로 생성하여 별도 named volume에 보관하고 backend에 읽기 전용 공급한다.
기본 frontend 포트는 8080, 직접 backend 포트는 8081이다. DB 포트는 publish하지 않는다.

운영에서는 DB_PASSWORD, DB_NAME, DB_USER와 공개 포트를 명시적으로 override하고 HTTPS reverse proxy를 둔다.
같은 database volume을 유지한 채 DB_PASSWORD만 바꾸면 기존 PostgreSQL 암호를 변경하지 않는다.
기존 DB의 암호를 먼저 갱신한 후 같은 값을 공급해야 한다. 데모 계정은 운영용 계정이 아니다.

실행: docker compose -f infra/docker-compose.yml up -d --build --wait
확인: nginx 경유 GET /api/health는 DB SELECT 1 성공 시에만 200이다.
화면 등록은 frontend/src/main.tsx의 createAppRouter 인자로 각 담당 단계의 실제 화면을 전달한다.
health 성공만으로 업무 화면 및 API 통합 완료를 판정하지 않는다.
