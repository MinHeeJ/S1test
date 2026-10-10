-- 로컬 데모 전용: 본문은 합성 한국어 예시이며 실제 인물의 경력 자료가 아니다.
INSERT INTO users (email, nickname, password_hash)
VALUES
    ('jiwoo@resume.dev', '지우', '$2b$12$6p1iAV4NqAMjKiPPvkXIyuTc20ONOukw8ty.2VhP3xLVKCNXDjSCO'),
    ('minjun@resume.dev', '민준', '$2b$12$6p1iAV4NqAMjKiPPvkXIyuTc20ONOukw8ty.2VhP3xLVKCNXDjSCO'),
    ('seoyeon@resume.dev', '서연', '$2b$12$6p1iAV4NqAMjKiPPvkXIyuTc20ONOukw8ty.2VhP3xLVKCNXDjSCO');

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '백엔드 개발자 이력서',
    'modern',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
      "jobTitle": "백엔드 개발자",
      "email": "jiwoo@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  },
  {
    "type": "summary",
    "hidden": false,
    "data": {
      "headline": "합성 데모 이력서",
      "body": "이 본문은 서비스 기능 확인을 위한 합성 데모이며 실제 개인의 경력을 나타내지 않습니다. 안정적인 API와 데이터 모델을 설계하고 팀과 함께 문제를 해결하는 개발자를 목표로 합니다."
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": [
      {
        "id": "3dfc713a-a575-4959-ad25-c7a22c5378ca",
        "company": "합성 데모 개발팀",
        "position": "서버 개발자",
        "start": "2022.03",
        "end": "",
        "description": "- 합성 데모: 사용자 요청의 경계를 분석하고 API, 저장 모델, 테스트를 함께 설계했습니다.\n- 트랜잭션 실패 시 변경 내용이 남지 않도록 원자성을 검증했습니다.\n- 운영 로그에서 개인정보를 제외하고 오류 메시지를 안정적으로 처리했습니다.\n- 데이터 조회의 인덱스와 실행 계획을 검토하여 응답 지연을 줄였습니다.\n- 팀 리뷰를 통해 변경 위험을 공유하고 반복 가능한 검증 환경을 만들었습니다.\n- 합성 데모: 사용자 요청의 경계를 분석하고 API, 저장 모델, 테스트를 함께 설계했습니다.\n- 트랜잭션 실패 시 변경 내용이 남지 않도록 원자성을 검증했습니다.\n- 운영 로그에서 개인정보를 제외하고 오류 메시지를 안정적으로 처리했습니다.\n- 데이터 조회의 인덱스와 실행 계획을 검토하여 응답 지연을 줄였습니다.\n- 팀 리뷰를 통해 변경 위험을 공유하고 반복 가능한 검증 환경을 만들었습니다.\n- 합성 데모: 사용자 요청의 경계를 분석하고 API, 저장 모델, 테스트를 함께 설계했습니다.\n- 트랜잭션 실패 시 변경 내용이 남지 않도록 원자성을 검증했습니다.\n- 운영 로그에서 개인정보를 제외하고 오류 메시지를 안정적으로 처리했습니다.\n- 데이터 조회의 인덱스와 실행 계획을 검토하여 응답 지연을 줄였습니다.\n- 팀 리뷰를 통해 변경 위험을 공유하고 반복 가능한 검증 환경을 만들었습니다.",
        "current": true
      },
      {
        "id": "82e8fd3f-326d-424b-ada3-8834d6a9122a",
        "company": "합성 데모 연구팀",
        "position": "개발 인턴",
        "start": "2021.03",
        "end": "2022.02",
        "description": "- 합성 데모: 사용자 요청의 경계를 분석하고 API, 저장 모델, 테스트를 함께 설계했습니다.\n- 트랜잭션 실패 시 변경 내용이 남지 않도록 원자성을 검증했습니다.\n- 운영 로그에서 개인정보를 제외하고 오류 메시지를 안정적으로 처리했습니다.\n- 데이터 조회의 인덱스와 실행 계획을 검토하여 응답 지연을 줄였습니다.\n- 팀 리뷰를 통해 변경 위험을 공유하고 반복 가능한 검증 환경을 만들었습니다.\n- 합성 데모: 사용자 요청의 경계를 분석하고 API, 저장 모델, 테스트를 함께 설계했습니다.\n- 트랜잭션 실패 시 변경 내용이 남지 않도록 원자성을 검증했습니다.\n- 운영 로그에서 개인정보를 제외하고 오류 메시지를 안정적으로 처리했습니다.\n- 데이터 조회의 인덱스와 실행 계획을 검토하여 응답 지연을 줄였습니다.\n- 팀 리뷰를 통해 변경 위험을 공유하고 반복 가능한 검증 환경을 만들었습니다.\n- 합성 데모: 사용자 요청의 경계를 분석하고 API, 저장 모델, 테스트를 함께 설계했습니다.\n- 트랜잭션 실패 시 변경 내용이 남지 않도록 원자성을 검증했습니다.\n- 운영 로그에서 개인정보를 제외하고 오류 메시지를 안정적으로 처리했습니다.\n- 데이터 조회의 인덱스와 실행 계획을 검토하여 응답 지연을 줄였습니다.\n- 팀 리뷰를 통해 변경 위험을 공유하고 반복 가능한 검증 환경을 만들었습니다.",
        "current": false
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "9f14f881-06fd-4e7a-824d-302ea6829fc2",
        "school": "데모대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2018.03",
        "end": "2022.02",
        "current": false
      }
    ]
  },
  {
    "type": "skills",
    "hidden": false,
    "data": {
      "tags": [
        "Java",
        "Spring",
        "PostgreSQL",
        "TypeScript",
        "React"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "11f0232d-4c22-4bb4-95a1-e9c7bed04891",
        "name": "데모 이력서 서비스",
        "role": "서버 개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "- 이력서 JSON 저장과 조회 기능을 설계했습니다.\n- 사용자별 소유권 검사를 적용했습니다.",
        "url": ""
      },
      {
        "id": "5331792a-bad4-483e-94ff-63bf7c4d3d6b",
        "name": "데모 검색 서비스",
        "role": "API 개발",
        "start": "",
        "end": "",
        "description": "- 검색 조건을 동적 쿼리로 구현했습니다.\n- 실행 계획을 검토하고 조회 성능을 개선했습니다.",
        "url": ""
      }
    ]
  },
  {
    "type": "certificates",
    "hidden": false,
    "items": [
      {
        "id": "35f68bb7-5db6-4e6b-85be-a639f09de6c2",
        "name": "데모 기술 자격",
        "issuer": "합성 데모 기관",
        "date": "2022.06"
      }
    ]
  },
  {
    "type": "languages",
    "hidden": false,
    "items": [
      {
        "id": "192d3b1e-3f99-40ca-8e59-da414596e5a5",
        "language": "영어",
        "test": "데모 평가",
        "score": "업무 문서 독해"
      }
    ]
  }
]$content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '신입 지원용',
    'classic',
    '{"color": "#2563EB", "font": "pretendard", "size": "medium"}'::jsonb,
    $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
      "jobTitle": "백엔드 개발자",
      "email": "jiwoo@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  },
  {
    "type": "summary",
    "hidden": false,
    "data": {
      "headline": "합성 데모 이력서",
      "body": "이 본문은 서비스 기능 확인을 위한 합성 데모이며 실제 개인의 경력을 나타내지 않습니다. 안정적인 API와 데이터 모델을 설계하고 팀과 함께 문제를 해결하는 개발자를 목표로 합니다."
    }
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "9f14f881-06fd-4e7a-824d-302ea6829fc2",
        "school": "데모대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2018.03",
        "end": "2022.02",
        "current": false
      }
    ]
  },
  {
    "type": "skills",
    "hidden": false,
    "data": {
      "tags": [
        "Java",
        "Spring",
        "PostgreSQL",
        "TypeScript",
        "React"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "11f0232d-4c22-4bb4-95a1-e9c7bed04891",
        "name": "데모 이력서 서비스",
        "role": "서버 개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "- 이력서 JSON 저장과 조회 기능을 설계했습니다.\n- 사용자별 소유권 검사를 적용했습니다.",
        "url": ""
      },
      {
        "id": "5331792a-bad4-483e-94ff-63bf7c4d3d6b",
        "name": "데모 검색 서비스",
        "role": "API 개발",
        "start": "",
        "end": "",
        "description": "- 검색 조건을 동적 쿼리로 구현했습니다.\n- 실행 계획을 검토하고 조회 성능을 개선했습니다.",
        "url": ""
      }
    ]
  }
]$content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '작성 중인 이력서',
    'classic',
    '{"color": "#374151", "font": "pretendard", "size": "medium"}'::jsonb,
    $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
      "jobTitle": "",
      "email": "jiwoo@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  },
  {
    "type": "experience",
    "hidden": true,
    "items": [
      {
        "id": "baa42e00-d919-4f65-bb9c-589335e84292",
        "company": "",
        "position": "",
        "start": "",
        "end": "",
        "description": "",
        "current": false
      }
    ]
  }
]$content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '민준 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "민준",
      "jobTitle": "백엔드 개발자",
      "email": "minjun@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  }
]$content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'minjun@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '서연 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "서연",
      "jobTitle": "백엔드 개발자",
      "email": "seoyeon@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  }
]$content$::jsonb,
    TRUE
FROM users u
WHERE u.email = 'seoyeon@resume.dev';
