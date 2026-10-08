-- 로컬 데모용 비실존 사용자와 이력서. 점수·페이지수·사진은 저장하지 않는다.
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '0591a3c0-0aa1-58f0-b380-bf78b7b8686a',
    'jiwoo@resume.dev',
    '지우',
    '$2b$12$nj0HUvimSOlVliHf5JSXQO/f8r0aQb3hwSSihhGl0BliJeBZYX5ka'
);
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '1fd77e68-3d72-5128-b656-5286bc3f9d84',
    'minjun@resume.dev',
    '민준',
    '$2b$12$nj0HUvimSOlVliHf5JSXQO/f8r0aQb3hwSSihhGl0BliJeBZYX5ka'
);
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '06f80073-4659-5793-82d8-e020f9151c6f',
    'seoyeon@resume.dev',
    '서연',
    '$2b$12$nj0HUvimSOlVliHf5JSXQO/f8r0aQb3hwSSihhGl0BliJeBZYX5ka'
);
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
      "headline": "안전한 데이터 처리",
      "body": "로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다.로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다.로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다."
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": [
      {
        "id": "17c21021-d685-58d6-8a5d-5658363a15ab",
        "company": "데모 서비스 연구소",
        "position": "백엔드 개발자",
        "start": "2022.03",
        "end": "",
        "current": true,
        "description": "1. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n2. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n3. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n4. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n5. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n6. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n7. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n8. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n9. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n10. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n11. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다.\n12. 로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다. API 경계와 데이터 저장 흐름을 점검하고 결과를 문서화했습니다."
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "7351afc8-a2bd-5d24-b819-3e423367e33a",
        "school": "데모 대학교",
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
        "React",
        "TypeScript"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "74a3aa25-59b4-5270-a408-20debb5d19de",
        "name": "데모 이력서 서비스",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.08",
        "description": "로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다.",
        "url": ""
      },
      {
        "id": "dd969282-c87f-5d32-9519-2fac0e190db6",
        "name": "데모 검색 서비스",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.08",
        "description": "로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다.",
        "url": ""
      }
    ]
  },
  {
    "type": "certificates",
    "hidden": false,
    "items": [
      {
        "id": "d70074ff-0ee9-5b7e-b685-8ed1f9e30646",
        "name": "데모 기술 인증",
        "issuer": "데모 기관",
        "date": "2022.05"
      }
    ]
  },
  {
    "type": "languages",
    "hidden": false,
    "items": [
      {
        "id": "2eefa242-654e-52b0-ab1e-7959f8f3592e",
        "language": "영어",
        "test": "데모 시험",
        "score": "상급"
      }
    ]
  }
]'::jsonb,
    FALSE
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
      "headline": "신입 개발자",
      "body": "로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다."
    }
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "7351afc8-a2bd-5d24-b819-3e423367e33a",
        "school": "데모 대학교",
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
        "React",
        "TypeScript"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "f71feba2-d3f1-5f76-96bd-f6f7aa6d78c1",
        "name": "데모 프로젝트 하나",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.08",
        "description": "로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다.",
        "url": ""
      },
      {
        "id": "b0abd818-45d4-5891-92e3-475947cb53df",
        "name": "데모 프로젝트 둘",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.08",
        "description": "로컬 데모용 비실존 프로젝트입니다. 사용자 입력을 안전하게 보관하고 변경 사항을 검증하는 서비스를 설계했습니다.",
        "url": ""
      }
    ]
  }
]'::jsonb,
    FALSE
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
        "id": "00295771-c1b5-56ed-8739-89c82714b382",
        "company": "",
        "position": "",
        "start": "",
        "end": "",
        "current": false,
        "description": ""
      }
    ]
  }
]'::jsonb,
    FALSE
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
    FALSE
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
    TRUE
);
