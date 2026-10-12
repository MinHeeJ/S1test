-- 명세의 데모 전용 fixture. 상세 문자열과 UUID는 합성 구현 fixture이며 운영 계정이 아니다.
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    'c4178a39-b6fc-5a5b-99cc-e8979d1496cd',
    'jiwoo@resume.dev',
    '지우',
    '$2a$12$90in1iX9sHgvYOm3MxPHGOCMT04LPHuq80QXVoXL70/fh2t8dxHqG'
);
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '153c1572-91e7-525e-b779-7bbad00d085b',
    'minjun@resume.dev',
    '민준',
    '$2a$12$90in1iX9sHgvYOm3MxPHGOCMT04LPHuq80QXVoXL70/fh2t8dxHqG'
);
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    'e218e958-3ec9-5863-ab5d-caa6ef599ca0',
    'seoyeon@resume.dev',
    '서연',
    '$2a$12$90in1iX9sHgvYOm3MxPHGOCMT04LPHuq80QXVoXL70/fh2t8dxHqG'
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'cafb22e2-f2ac-5331-b0e1-b6d741afeb74',
    'c4178a39-b6fc-5a5b-99cc-e8979d1496cd',
    '백엔드 개발자 이력서',
    'modern',
    $json${
  "color": "#1F3A5F",
  "font": "pretendard",
  "size": "medium"
}$json$::jsonb,
    $json$[
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
      "headline": "안정적인 서비스를 만드는 개발자",
      "body": "사용자 경험과 데이터 안정성을 함께 고려합니다."
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": [
      {
        "id": "68700995-7bd5-5e01-8884-6b7e74bf3423",
        "company": "예제 기술 1",
        "position": "백엔드 개발",
        "start": "2021.03",
        "end": "",
        "current": true,
        "description": "서비스의 안정성과 데이터 흐름을 개선했습니다. API 설계와 성능 측정, 배포 자동화와 장애 분석을 담당하며 운영 경험을 공유했습니다."
      },
      {
        "id": "96473cdc-280f-5e63-a656-9131bb56a930",
        "company": "예제 기술 2",
        "position": "백엔드 개발",
        "start": "2021.03",
        "end": "",
        "current": true,
        "description": "서비스의 안정성과 데이터 흐름을 개선했습니다. API 설계와 성능 측정, 배포 자동화와 장애 분석을 담당하며 운영 경험을 공유했습니다."
      },
      {
        "id": "fb21bc83-da15-57f0-8695-38c12bfccea6",
        "company": "예제 기술 3",
        "position": "백엔드 개발",
        "start": "2021.03",
        "end": "",
        "current": true,
        "description": "서비스의 안정성과 데이터 흐름을 개선했습니다. API 설계와 성능 측정, 배포 자동화와 장애 분석을 담당하며 운영 경험을 공유했습니다."
      },
      {
        "id": "90e44a8a-b221-5780-a67e-a41d019548a4",
        "company": "예제 기술 4",
        "position": "백엔드 개발",
        "start": "2021.03",
        "end": "",
        "current": true,
        "description": "서비스의 안정성과 데이터 흐름을 개선했습니다. API 설계와 성능 측정, 배포 자동화와 장애 분석을 담당하며 운영 경험을 공유했습니다."
      },
      {
        "id": "b936a5c9-82fa-5a19-82fb-cb44412d5bd2",
        "company": "예제 기술 5",
        "position": "백엔드 개발",
        "start": "2021.03",
        "end": "",
        "current": true,
        "description": "서비스의 안정성과 데이터 흐름을 개선했습니다. API 설계와 성능 측정, 배포 자동화와 장애 분석을 담당하며 운영 경험을 공유했습니다."
      },
      {
        "id": "54022c5a-afb9-5216-85cb-5e65c0c0bde5",
        "company": "예제 기술 6",
        "position": "백엔드 개발",
        "start": "2021.03",
        "end": "",
        "current": true,
        "description": "서비스의 안정성과 데이터 흐름을 개선했습니다. API 설계와 성능 측정, 배포 자동화와 장애 분석을 담당하며 운영 경험을 공유했습니다."
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "c40fe74f-a13d-52be-8f7a-b561eeb2fbd6",
        "school": "예제대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2017.03",
        "end": "2021.02",
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
        "Docker",
        "TypeScript"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "03a13779-48a3-5b56-9f06-31d49ae69b90",
        "name": "서비스 개선 프로젝트",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "API와 데이터 흐름을 개선했습니다.",
        "url": ""
      }
    ]
  },
  {
    "type": "certificates",
    "hidden": false,
    "items": [
      {
        "id": "2fbda9d1-4edf-568c-a392-aab790779de4",
        "name": "정보처리기사",
        "issuer": "한국산업인력공단",
        "date": "2021.06"
      }
    ]
  },
  {
    "type": "languages",
    "hidden": false,
    "items": [
      {
        "id": "6a826375-7cbd-5a7e-a0af-3dbe14ff10ea",
        "language": "영어",
        "test": "TOEIC",
        "score": "850"
      }
    ]
  }
]$json$::jsonb,
    FALSE
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'dde5ac18-c1a4-5b95-a7fd-f7966bef2f92',
    'c4178a39-b6fc-5a5b-99cc-e8979d1496cd',
    '신입 지원용',
    'classic',
    $json${
  "color": "#2563EB",
  "font": "pretendard",
  "size": "medium"
}$json$::jsonb,
    $json$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
      "jobTitle": "개발자",
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
      "body": "함께 배우며 성장하는 개발자입니다."
    }
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "44ee2192-a318-5bba-af1a-da8d61b1a504",
        "school": "예제대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2017.03",
        "end": "2021.02",
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
        "Docker"
      ]
    }
  },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "f3aa93c0-f452-5104-a5fe-e087d4f18654",
        "name": "서비스 개선 프로젝트",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "API와 데이터 흐름을 개선했습니다.",
        "url": ""
      },
      {
        "id": "4b572e69-2a86-5aa7-8ff0-22b7b83e2524",
        "name": "서비스 개선 프로젝트",
        "role": "개발",
        "start": "2023.01",
        "end": "2023.12",
        "description": "API와 데이터 흐름을 개선했습니다.",
        "url": ""
      }
    ]
  }
]$json$::jsonb,
    FALSE
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'b0e173b0-13e5-578f-bc7d-13a1da5cff78',
    'c4178a39-b6fc-5a5b-99cc-e8979d1496cd',
    '작성 중인 이력서',
    'classic',
    $json${
  "color": "#374151",
  "font": "pretendard",
  "size": "medium"
}$json$::jsonb,
    $json$[
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
        "id": "8c96139e-cb7f-5c46-8493-d46234a96a5d",
        "company": "",
        "position": "",
        "start": "",
        "end": "",
        "current": false,
        "description": ""
      }
    ]
  }
]$json$::jsonb,
    FALSE
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    'b3057d53-4ea7-5d9d-b9c2-849824bb8f71',
    '153c1572-91e7-525e-b779-7bbad00d085b',
    '민준 이력서',
    'classic',
    $json${
  "color": "#1F3A5F",
  "font": "pretendard",
  "size": "medium"
}$json$::jsonb,
    $json$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "민준",
      "jobTitle": "개발자",
      "email": "minjun@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  }
]$json$::jsonb,
    FALSE
);
INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '86a1dbb6-e00c-56cf-92bc-c5706169744f',
    'e218e958-3ec9-5863-ab5d-caa6ef599ca0',
    '서연 이력서',
    'classic',
    $json${
  "color": "#1F3A5F",
  "font": "pretendard",
  "size": "medium"
}$json$::jsonb,
    $json$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "서연",
      "jobTitle": "개발자",
      "email": "seoyeon@resume.dev",
      "phone": "",
      "links": [],
      "photoId": null
    }
  }
]$json$::jsonb,
    TRUE
);
