-- 재현 가능한 합성 데모 계정과 본문. 사진과 완성도/페이지 컬럼을 만들지 않는다.
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    'dc9ae1a6-c7ce-58e8-a30c-5a962ded9ae2',
    'jiwoo@resume.dev',
    '지우',
    '$2b$12$axZTezkXyx0QXZ6zCfAKAe5XRS1/SX7HFj7iTeH7BB.R3GnM4g2mq'
);

INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '2a18b0ed-67db-5bf8-afdd-501576fd365c',
    'minjun@resume.dev',
    '민준',
    '$2b$12$axZTezkXyx0QXZ6zCfAKAe5XRS1/SX7HFj7iTeH7BB.R3GnM4g2mq'
);

INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    'fd0702fe-41ce-524f-9df7-0e7369530fd5',
    'seoyeon@resume.dev',
    '서연',
    '$2b$12$axZTezkXyx0QXZ6zCfAKAe5XRS1/SX7HFj7iTeH7BB.R3GnM4g2mq'
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'e91eebbd-639e-5c65-aa16-ce190cefb9cc',
    'dc9ae1a6-c7ce-58e8-a30c-5a962ded9ae2',
    '백엔드 개발자 이력서',
    'modern',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    '[{"type":"basics","hidden":false,"data":{"name":"지우","jobTitle":"백엔드 개발자","email":"jiwoo@r'
    'esume.dev","phone":"","links":[],"photoId":null}},{"type":"summary","hidden":false,"data":'
    '{"headline":"안정적인 서비스를 만드는 개발자","body":"사용자 관점에서 문제를 정의하고 데이터와 테스트로 개선하는 합성 데모 이력서입니다."}},'
    '{"type":"experience","hidden":false,"items":[{"id":"16bed868-e995-58df-9ba7-c4c345a59135",'
    '"company":"데모 서비스 연구소","position":"서버 개발자","start":"2021.03","end":"","current":true,"desc'
    'ription":"- 요구사항을 작은 처리 흐름으로 나누고 입력과 출력의 경계를 문서화했습니다.\n- 사용자 소유 데이터의 조회와 변경 조건을 통합하고 권한 경계'
    '를 검증했습니다.\n- 실제 PostgreSQL 환경에서 JSON 본문과 이미지 원본의 왕복을 검증했습니다.\n- 동시 요청과 중복 입력을 재현하여 데이터 제약과'
    ' 트랜잭션의 역할을 확인했습니다.\n- 서비스 장애를 재현 가능한 테스트로 남기고 변경 전후의 동작을 비교했습니다.\n- 느린 조회를 분석하고 소유자와 수정 시간'
    '에 맞는 인덱스를 검토했습니다.\n- 배포 과정의 환경 설정을 문서화하고 비밀 정보가 이미지에 포함되지 않게 했습니다.\n- 오류 응답 형식을 맞추어 사용자가 다'
    '시 시도할 수 있도록 개선했습니다.\n- 이미지 업로드와 문서 연결을 분리하고 실패 후 기존 문서를 보존했습니다.\n- 작업 결과를 검토하며 테스트 누락과 경계 '
    '조건을 보완했습니다.\n- 작은 변경을 자주 배포하고 서비스의 관찰 결과로 다음 개선을 결정했습니다.\n- 사용자 피드백을 수집하고 접근성과 모바일 입력 흐름을 '
    '함께 검토했습니다."}]},{"type":"education","hidden":false,"items":[{"id":"c8ce35c1-b3eb-57b8-961f-'
    '9a147c03b5e8","school":"데모대학교","major":"컴퓨터공학","degree":"학사","start":"2017.03","end":"2021'
    '.02","current":false}]},{"type":"skills","hidden":false,"data":{"tags":["Java","Spring","P'
    'ostgreSQL","TypeScript","React"]}},{"type":"projects","hidden":false,"items":[{"id":"12219'
    'ec8-5f30-5695-80c1-13a86e788d1a","name":"이력서 편집 서비스","role":"개발","start":"2023.01","end":"'
    '2023.12","description":"- 사용자 입력을 검증하고 데이터 흐름을 개선했습니다.","url":""},{"id":"76a4f2e9-5131-5e9'
    '0-b608-b890205ceeb3","name":"문서 검색 서비스","role":"개발","start":"2023.01","end":"2023.12","des'
    'cription":"- 사용자 입력을 검증하고 데이터 흐름을 개선했습니다.","url":""}]},{"type":"certificates","hidden":fal'
    'se,"items":[{"id":"af376d68-9057-5d38-9fbe-90e2eb416d2d","name":"정보처리기사","issuer":"데모 발급기관'
    '","date":"2021.06"}]},{"type":"languages","hidden":false,"items":[{"id":"4fd5e159-7f1b-5ec'
    '5-b241-e73828891d5e","language":"영어","test":"데모 시험","score":"업무 의사소통"}]}]'::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'ddae58be-2266-56bf-8cad-ddce29e24e48',
    'dc9ae1a6-c7ce-58e8-a30c-5a962ded9ae2',
    '신입 지원용',
    'classic',
    '{"color": "#2563EB", "font": "pretendard", "size": "medium"}'::jsonb,
    '[{"type":"basics","hidden":false,"data":{"name":"지우","jobTitle":"백엔드 개발자","email":"jiwoo@r'
    'esume.dev","phone":"","links":[],"photoId":null}},{"type":"summary","hidden":false,"data":'
    '{"headline":"신입 개발자","body":"프로젝트에서 배운 내용을 바탕으로 신뢰할 수 있는 서비스를 만들고 싶습니다."}},{"type":"educat'
    'ion","hidden":false,"items":[{"id":"c8ce35c1-b3eb-57b8-961f-9a147c03b5e8","school":"데모대학교"'
    ',"major":"컴퓨터공학","degree":"학사","start":"2017.03","end":"2021.02","current":false}]},{"type'
    '":"skills","hidden":false,"data":{"tags":["Java","Spring","PostgreSQL","TypeScript","React'
    '"]}},{"type":"projects","hidden":false,"items":[{"id":"12219ec8-5f30-5695-80c1-13a86e788d1'
    'a","name":"이력서 편집 서비스","role":"개발","start":"2023.01","end":"2023.12","description":"- 사용자 '
    '입력을 검증하고 데이터 흐름을 개선했습니다.","url":""},{"id":"76a4f2e9-5131-5e90-b608-b890205ceeb3","name":"문'
    '서 검색 서비스","role":"개발","start":"2023.01","end":"2023.12","description":"- 사용자 입력을 검증하고 데이터 '
    '흐름을 개선했습니다.","url":""}]}]'::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'bc9b14d2-27c2-5939-ae69-5c13d1ad1eb5',
    'dc9ae1a6-c7ce-58e8-a30c-5a962ded9ae2',
    '작성 중인 이력서',
    'classic',
    '{"color": "#374151", "font": "pretendard", "size": "medium"}'::jsonb,
    '[{"type":"basics","hidden":false,"data":{"name":"지우","jobTitle":"","email":"jiwoo@resume.d'
    'ev","phone":"","links":[],"photoId":null}},{"type":"experience","hidden":true,"items":[{"i'
    'd":"616436fc-023f-5463-9fcf-48a2598c94cf","company":"","position":"","start":"","end":"","'
    'current":false,"description":""}]}]'::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '21b67249-4922-596c-80f0-8ea02f139404',
    '2a18b0ed-67db-5bf8-afdd-501576fd365c',
    '민준 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    '[{"type":"basics","hidden":false,"data":{"name":"민준","jobTitle":"백엔드 개발자","email":"minjun@'
    'resume.dev","phone":"","links":[],"photoId":null}}]'::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '09b116fa-9295-5736-8789-2d534a7f6ee6',
    'fd0702fe-41ce-524f-9df7-0e7369530fd5',
    '서연 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    '[{"type":"basics","hidden":false,"data":{"name":"서연","jobTitle":"백엔드 개발자","email":"seoyeon'
    '@resume.dev","phone":"","links":[],"photoId":null}}]'::jsonb,
    true
);
