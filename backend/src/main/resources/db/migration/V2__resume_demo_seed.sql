-- 개발 전용 합성 데모 fixture. 점수·페이지 수와 사진 행은 저장하지 않는다.
INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '10000000-0000-4000-8000-000000000001',
    'jiwoo@resume.dev',
    '지우',
    crypt('demo1234', gen_salt('bf', 10))
);

INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '10000000-0000-4000-8000-000000000002',
    'minjun@resume.dev',
    '민준',
    crypt('demo1234', gen_salt('bf', 10))
);

INSERT INTO users (id, email, nickname, password_hash)
VALUES (
    '10000000-0000-4000-8000-000000000003',
    'seoyeon@resume.dev',
    '서연',
    crypt('demo1234', gen_salt('bf', 10))
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '백엔드 개발자 이력서',
    'modern',
    $style${"color": "#1F3A5F", "font": "pretendard", "size": "medium"}$style$::jsonb,
    $content$
[
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
      "body": "데모용 합성 이력서입니다. 사용자 관점에서 요구사항을 정리하고 API와 데이터 모델을 함께 설계합니다. 문제의 재현 조건을 먼저 기록하고 테스트와 관찰 가능한 지표로 개선 결과를 확인합니다. 팀과 설계 근거를 공유하며 읽기 쉬운 코드를 유지합니다."
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000001",
        "company": "합성 서비스 1",
        "position": "백엔드 개발자",
        "start": "2019.03",
        "end": "2020.02",
        "current": false,
        "description": "- 사용자 요청의 처리 흐름을 분석하고 입력 검증과 소유권 확인을 일관되게 적용했습니다.\n- 데이터베이스 실행 계획을 확인하고 복합 인덱스를 조정하여 조회 경로를 개선했습니다.\n- 재현 가능한 통합 테스트로 트랜잭션 실패 시 데이터가 보존되는지 검증했습니다.\n- 배포 전 점검 목록과 장애 대응 문서를 작성하여 팀의 운영 경험을 공유했습니다.\n- 기능의 성공과 실패 조건을 정리하고 변경 영향 범위를 동료와 함께 검토했습니다.\n- API 응답 계약과 프론트 입력 흐름을 대조하여 사용자 안내가 누락되지 않도록 개선했습니다."
      },
      {
        "id": "30000000-0000-4000-8000-000000000002",
        "company": "합성 서비스 2",
        "position": "백엔드 개발자",
        "start": "2020.03",
        "end": "2021.02",
        "current": false,
        "description": "- 사용자 요청의 처리 흐름을 분석하고 입력 검증과 소유권 확인을 일관되게 적용했습니다.\n- 데이터베이스 실행 계획을 확인하고 복합 인덱스를 조정하여 조회 경로를 개선했습니다.\n- 재현 가능한 통합 테스트로 트랜잭션 실패 시 데이터가 보존되는지 검증했습니다.\n- 배포 전 점검 목록과 장애 대응 문서를 작성하여 팀의 운영 경험을 공유했습니다.\n- 기능의 성공과 실패 조건을 정리하고 변경 영향 범위를 동료와 함께 검토했습니다.\n- API 응답 계약과 프론트 입력 흐름을 대조하여 사용자 안내가 누락되지 않도록 개선했습니다."
      },
      {
        "id": "30000000-0000-4000-8000-000000000003",
        "company": "합성 서비스 3",
        "position": "백엔드 개발자",
        "start": "2021.03",
        "end": "2022.02",
        "current": true,
        "description": "- 사용자 요청의 처리 흐름을 분석하고 입력 검증과 소유권 확인을 일관되게 적용했습니다.\n- 데이터베이스 실행 계획을 확인하고 복합 인덱스를 조정하여 조회 경로를 개선했습니다.\n- 재현 가능한 통합 테스트로 트랜잭션 실패 시 데이터가 보존되는지 검증했습니다.\n- 배포 전 점검 목록과 장애 대응 문서를 작성하여 팀의 운영 경험을 공유했습니다.\n- 기능의 성공과 실패 조건을 정리하고 변경 영향 범위를 동료와 함께 검토했습니다.\n- API 응답 계약과 프론트 입력 흐름을 대조하여 사용자 안내가 누락되지 않도록 개선했습니다."
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000004",
        "school": "합성대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2015.03",
        "end": "2019.02",
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
        "Spring Boot",
        "PostgreSQL",
        "MyBatis",
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
        "id": "30000000-0000-4000-8000-000000000005",
        "name": "합성 프로젝트 1",
        "role": "API 설계 및 개발",
        "start": "2023.03",
        "end": "2023.12",
        "description": "- 사용자 시나리오에서 읽기와 쓰기 경계를 도출하고 API 계약을 먼저 정의했습니다.\n- 소유자 필터와 상태 조건을 데이터 접근 계층에도 적용하여 정보 노출을 예방했습니다.\n- 실패한 명령의 영향 행 수와 롤백을 확인하는 테스트를 추가했습니다.\n- 운영 환경에서 연결 상태와 마이그레이션 완료를 분리하여 관찰했습니다.",
        "url": ""
      },
      {
        "id": "30000000-0000-4000-8000-000000000006",
        "name": "합성 프로젝트 2",
        "role": "API 설계 및 개발",
        "start": "2023.03",
        "end": "2023.12",
        "description": "- 사용자 시나리오에서 읽기와 쓰기 경계를 도출하고 API 계약을 먼저 정의했습니다.\n- 소유자 필터와 상태 조건을 데이터 접근 계층에도 적용하여 정보 노출을 예방했습니다.\n- 실패한 명령의 영향 행 수와 롤백을 확인하는 테스트를 추가했습니다.\n- 운영 환경에서 연결 상태와 마이그레이션 완료를 분리하여 관찰했습니다.",
        "url": ""
      }
    ]
  },
  {
    "type": "certificates",
    "hidden": false,
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000008",
        "name": "합성 정보처리 자격",
        "issuer": "데모 발급 기관",
        "date": "2019.06"
      }
    ]
  },
  {
    "type": "languages",
    "hidden": false,
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000009",
        "language": "영어",
        "test": "합성 어학 시험",
        "score": "850"
      }
    ]
  }
]
$content$::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '신입 지원용',
    'classic',
    $style${"color": "#2563EB", "font": "pretendard", "size": "medium"}$style$::jsonb,
    $content$
[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
      "jobTitle": "신입 개발자",
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
      "headline": "배우고 실천하는 개발자",
      "body": "학습한 내용을 작은 프로젝트로 검증하고 팀과 함께 개선합니다."
    }
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000010",
        "school": "합성대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2020.03",
        "end": "2024.02",
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
        "SQL",
        "Git",
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
        "id": "30000000-0000-4000-8000-000000000011",
        "name": "학습 프로젝트 1",
        "role": "개발",
        "start": "2023.03",
        "end": "2023.06",
        "description": "API 계약과 테스트를 작성한 합성 학습 프로젝트입니다.",
        "url": ""
      },
      {
        "id": "30000000-0000-4000-8000-000000000012",
        "name": "학습 프로젝트 2",
        "role": "개발",
        "start": "2023.03",
        "end": "2023.06",
        "description": "API 계약과 테스트를 작성한 합성 학습 프로젝트입니다.",
        "url": ""
      }
    ]
  }
]
$content$::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '작성 중인 이력서',
    'classic',
    $style${"color": "#374151", "font": "pretendard", "size": "medium"}$style$::jsonb,
    $content$
[
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
    "type": "summary",
    "hidden": false,
    "data": {
      "headline": "",
      "body": ""
    }
  },
  {
    "type": "experience",
    "hidden": true,
    "items": [
      {
        "id": "30000000-0000-4000-8000-000000000013",
        "company": "",
        "position": "",
        "start": "",
        "end": "",
        "current": false,
        "description": ""
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": []
  },
  {
    "type": "skills",
    "hidden": false,
    "data": {
      "tags": []
    }
  }
]
$content$::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    '민준 이력서',
    'classic',
    $style${"color": "#1F3A5F", "font": "pretendard", "size": "medium"}$style$::jsonb,
    $content$
[
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
  },
  {
    "type": "summary",
    "hidden": false,
    "data": {
      "headline": "",
      "body": ""
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": []
  },
  {
    "type": "education",
    "hidden": false,
    "items": []
  },
  {
    "type": "skills",
    "hidden": false,
    "data": {
      "tags": []
    }
  }
]
$content$::jsonb,
    false
);

INSERT INTO resume (id, user_id, title, template, style, content, deleted)
VALUES (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    '서연 이력서',
    'classic',
    $style${"color": "#1F3A5F", "font": "pretendard", "size": "medium"}$style$::jsonb,
    $content$
[
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
  },
  {
    "type": "summary",
    "hidden": false,
    "data": {
      "headline": "",
      "body": ""
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "items": []
  },
  {
    "type": "education",
    "hidden": false,
    "items": []
  },
  {
    "type": "skills",
    "hidden": false,
    "data": {
      "tags": []
    }
  }
]
$content$::jsonb,
    true
);
