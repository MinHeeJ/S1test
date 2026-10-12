# ResumeCraft 개발 실행

`sh infra/start-demo.sh`를 저장소 루트에서 실행한다. 최초 실행은 메모리에서 DB 비밀번호를 생성하며,
기존 DB 컨테이너가 있으면 그 컨테이너의 값을 재사용한다. 값을 출력하거나 파일에 쓰지 않는다.
Docker Compose V2와 launcher용 Python 3가 필요하다. DB 컨테이너 없이 기존 볼륨만 남은 경우에는
기존 DB_PASSWORD를 환경으로 제공해야 한다. 개발 데이터를 버려도 된다면 `docker compose -f
infra/docker-compose.yml down -v` 이후 다시 시작한다.

프론트 주소는 http://127.0.0.1:3000, 백엔드는 http://127.0.0.1:8080이다. nginx는 비특권 포트 8080을
사용한다. DB는 host port를 노출하지 않는다. `DB_NAME`, `DB_USER`, `DB_PASSWORD`는 환경으로
주입한다. Compose 직접 실행도 개발 기본값으로 동작하지만 운영에서는 비밀번호와 연결값을 반드시
재정의하고 TLS를 적용해야 한다. 개발 기본값은 운영 승인값이 아니다.

Node 20 / React 18 / Vite 5 / Java 17 / Spring Boot 3.3 / PostgreSQL 16 / MyBatis를 사용한다.
프론트 Docker build에는 npm이 생성한 package-lock.json이 필요하다. foundation self-check가 선택된
npm으로 materialize하며 lockfile을 손으로 작성하지 않는다. Node build stage에 테스트를 포함하고
nginx runtime에는 dist만 복사한다. 백엔드는 executable boot jar로 실행한다.

HTML은 nginx가 실제 정적 파일을 제공한다. 내부 auth_request가 backend의 공개 HTML 경계(`/`)에서
XSRF-TOKEN을 받아 HTML 응답에 전달한다. 변경 요청은 cookie 값과 X-XSRF-TOKEN header를 함께
전달하며 가입/로그인도 CSRF 보호한다. 로그인/로그아웃 후 HTML을 다시 조회한다. 인증 성공 후
SessionAuthentication.establish(request,response,userId)를 호출하면 세션 ID가 회전하고 UUID principal이
저장된다. signup은 서비스 트랜잭션이 반환한 뒤 이 helper를 호출한다. 업무 controller는 세션의 UUID를
CurrentUserId.require()로 조회하거나 동일 UUID principal을 사용한다.

health는 실제 SELECT 1과 Flyway validate/적용 완료를 확인한다. 실패 응답은 D19에 따라 503이며
immutable OpenAPI fixture는 수정하지 않는다. 200 응답에는 success/meta만 있고 업무 data는 없다.

PostgreSQL JUnit 검증은 TEST_DB_URL이 있을 때만 실행하며 TEST_DB_USER/TEST_DB_PASSWORD도
환경으로 지정한다. 항상 테스트 DB를 사용한다. 임시 schema에 전체 migration을 적용하고 테스트가
끝나면 제거한다. DB 없는 단위/MVC runner에서는 이 시험을 skip하며 별도 SQL runner가 migration을
검증한다. 순수 단위/MVC 성공만으로 PostgreSQL 왕복이 입증되었다고 해석하지 않는다.

foundation은 공통 구조만 제공한다. 실제 인증·이력서·사진 화면은 각 기능 소유 단계가 제공하고,
frontend/src/app/main.tsx는 features 아래 ScLogin/ScSignup/ScResumes/ScEditor/ScPrint를 발견한다.
최종 등록 단계는 AppRoutes의 Screens에 실제 컴포넌트를 넘길 수도 있다. 헤더 onLogout callback은
편집기의 최신 변경 flush를 마친 뒤 로그아웃해야 한다. 별도 관리자·권한·인쇄 메뉴는 없다.

DB 시드는 개발 전용 합성 상세 문자열이다. 세 데모 계정은 요구된 demo1234로 로그인할 수 있으며,
점수와 페이지는 DB에 저장하지 않는다. 실제 두 페이지 출력은 합쳐진 renderer에서 확인해야 한다.
보관기간/at-rest 운영 정책과 JPA 원문 대비 MyBatis 선택의 실제 사용자 승인은 미확보 상태다.
