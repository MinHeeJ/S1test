-- 사진 없는 명시 데모 계정과 이력서. 본문 중 합성 데모 표기는 승인되지 않은 예시 텍스트를 구분한다.
INSERT INTO users (id, email, nickname, password_hash)
VALUES
    ('0591a3c0-0aa1-58f0-b380-bf78b7b8686a',
        'jiwoo@resume.dev',
        '지우',
        '$2b$12$NQOFWtrZY7EOIT1Ddi3FmOwVlyYra9VMwYlTtMb6iIaM8KhU6Ftw.'),
    ('1fd77e68-3d72-5128-b656-5286bc3f9d84',
        'minjun@resume.dev',
        '민준',
        '$2b$12$NQOFWtrZY7EOIT1Ddi3FmOwVlyYra9VMwYlTtMb6iIaM8KhU6Ftw.'),
    ('06f80073-4659-5793-82d8-e020f9151c6f',
        'seoyeon@resume.dev',
        '서연',
        '$2b$12$NQOFWtrZY7EOIT1Ddi3FmOwVlyYra9VMwYlTtMb6iIaM8KhU6Ftw.');
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '5e13ff1e-edc4-516e-9162-8b255a1835ab',
    '0591a3c0-0aa1-58f0-b380-bf78b7b8686a',
    '백엔드 개발자 이력서',
    'modern',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    '[
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
      "headline": "합성 데모 소개",
      "body": "서비스의 안정적인 저장과 사용자 경험을 함께 고민하는 개발자입니다."
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": [
      {
        "id": "72bbae10-980c-49b5-8754-41bd76d66df6",
        "company": "합성 데모 회사",
        "position": "개발자",
        "start": "2022.03",
        "end": "",
        "current": true,
        "description": "- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다."
      },
      {
        "id": "2351ddf0-3756-47df-b015-2c6ab34a8193",
        "company": "합성 데모 연구소",
        "position": "개발자",
        "start": "2022.03",
        "end": "",
        "current": true,
        "description": "- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다.\n- 합성 데모: 서비스 요구를 분석하고 데이터 모델과 API를 구현하여 검증 결과를 문서화했습니다."
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "5544ceea-a1dc-4d25-8ba9-617ccb5d1a72",
        "school": "합성 데모 대학교",
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
        "PostgreSQL",
        "React",
        "TypeScript",
        "Spring"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "49f3f467-a070-41f9-8ff2-b0bb3279b9a3",
        "name": "합성 데모 이력서 서비스",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "합성 데모 프로젝트 설명",
        "url": ""
      }
    ]
  },
  {
    "type": "certificates",
    "hidden": false,
    "items": [
      {
        "id": "3e606ebc-c63b-410d-bb51-ccd188ad034f",
        "name": "합성 데모 자격증",
        "issuer": "합성 데모 기관",
        "date": "2022.05"
      }
    ]
  },
  {
    "type": "languages",
    "hidden": false,
    "items": [
      {
        "id": "b1cdf4fe-4cf1-4418-b2aa-4dabb8d5c298",
        "language": "영어",
        "test": "합성 데모 시험",
        "score": "900"
      }
    ]
  }
]'::jsonb,
    false
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '059ab0f4-7c8c-576b-a0b0-3f16e1d89da3',
    '0591a3c0-0aa1-58f0-b380-bf78b7b8686a',
    '신입 지원용',
    'classic',
    '{"color": "#2563EB", "font": "pretendard", "size": "medium"}'::jsonb,
    '[
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
      "headline": "",
      "body": "배우고 기록하며 성장하는 개발자입니다."
    }
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "5544ceea-a1dc-4d25-8ba9-617ccb5d1a72",
        "school": "합성 데모 대학교",
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
        "React",
        "SQL",
        "Git",
        "TypeScript"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "3b8f67a6-bb5c-4abe-8cd8-cba254476478",
        "name": "합성 데모 프로젝트 A",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "합성 데모 프로젝트 설명",
        "url": ""
      },
      {
        "id": "87c13dbe-1d7b-4b4c-afdd-ba93e0869a05",
        "name": "합성 데모 프로젝트 B",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "합성 데모 프로젝트 설명",
        "url": ""
      }
    ]
  }
]'::jsonb,
    false
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'b4ad3963-ad8f-5a45-843b-670886548eea',
    '0591a3c0-0aa1-58f0-b380-bf78b7b8686a',
    '작성 중인 이력서',
    'classic',
    '{"color": "#374151", "font": "pretendard", "size": "medium"}'::jsonb,
    '[
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
        "id": "6117b66d-39f1-4df8-98bd-ff513150bc17",
        "company": "",
        "position": "개발자",
        "start": "2022.03",
        "end": "",
        "current": true,
        "description": ""
      }
    ]
  }
]'::jsonb,
    false
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'bfe3a4ee-cffb-5fff-a756-aaf28ae103d1',
    '1fd77e68-3d72-5128-b656-5286bc3f9d84',
    '민준 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    '[
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
]'::jsonb,
    false
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'f23a39d4-fc54-5b24-b84e-a4764f6770ee',
    '06f80073-4659-5793-82d8-e020f9151c6f',
    '서연 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    '[
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
]'::jsonb,
    true
);
