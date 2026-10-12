-- 개발용 합성 데이터. 사진 및 파생 완성도/페이지 수를 저장하지 않는다.
INSERT INTO users (email, nickname, password_hash)
VALUES
    ('jiwoo@resume.dev', '지우', '$2b$10$i2eBbHAiNIpAFTv6qwNU8uMgY23er5kV5ipDVRqEtmI02VyeYVnNS'),
    ('minjun@resume.dev', '민준', '$2b$10$i2eBbHAiNIpAFTv6qwNU8uMgY23er5kV5ipDVRqEtmI02VyeYVnNS'),
    ('seoyeon@resume.dev', '서연', '$2b$10$i2eBbHAiNIpAFTv6qwNU8uMgY23er5kV5ipDVRqEtmI02VyeYVnNS');

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
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
          "body": "이 문서는 실제 개인 정보가 아닌 개발용 합성 이력서입니다. 사용자 입력과 데이터 흐름을 이해하고 유지보수 가능한 서비스를 만드는 일에 관심이 있습니다."
        }
      },
      {
        "type": "experience",
        "hidden": false,
        "items": [
          {
            "id": "f09d4931-f5eb-5f4b-a267-941ae4a0d447",
            "company": "데모 기술 연구소",
            "position": "백엔드 개발",
            "start": "2022.03",
            "end": "",
            "current": true,
            "description": "개발용 합성 본문"
          }
        ]
      },
      {
        "type": "education",
        "hidden": false,
        "items": [
          {
            "id": "d99ca6e8-edb6-55c8-ab68-ca4a84df44a1",
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
            "id": "4974d6f3-f1aa-598b-b90e-f0180e0a55c4",
            "name": "데모 서비스 1",
            "role": "API 및 데이터 모델 개발",
            "start": "2023.01",
            "end": "2023.06",
            "description": "개발용 합성 본문",
            "url": ""
          },
          {
            "id": "964450db-ae6e-5ee0-9505-96917f2b498e",
            "name": "데모 서비스 2",
            "role": "API 및 데이터 모델 개발",
            "start": "2023.01",
            "end": "2023.06",
            "description": "개발용 합성 본문",
            "url": ""
          },
          {
            "id": "3ce2b3fc-5e0a-56de-9dd0-a399a60f0d97",
            "name": "데모 서비스 3",
            "role": "API 및 데이터 모델 개발",
            "start": "2023.01",
            "end": "2023.06",
            "description": "개발용 합성 본문",
            "url": ""
          }
        ]
      },
      {
        "type": "certificates",
        "hidden": false,
        "items": [
          {
            "id": "a7bb77fc-7bbb-594a-8c3e-327a57f80301",
            "name": "데모 정보처리 자격",
            "issuer": "데모 평가 기관",
            "date": "2022.05"
          }
        ]
      },
      {
        "type": "languages",
        "hidden": false,
        "items": [
          {
            "id": "7cdc63a3-837c-55a2-ac4f-a04a852e7f33",
            "language": "영어",
            "test": "데모 어학 평가",
            "score": "업무 문서 독해"
          }
        ]
      }
    ]
    $content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
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
          "headline": "신입 개발자 지원",
          "body": "개발용 합성 문서입니다. 프로젝트로 협업과 API 개발 경험을 쌓았습니다."
        }
      },
      {
        "type": "education",
        "hidden": false,
        "items": [
          {
            "id": "d99ca6e8-edb6-55c8-ab68-ca4a84df44a1",
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
            "SQL",
            "Git",
            "React"
          ]
        }
      },
      {
        "type": "projects",
        "hidden": false,
        "items": [
          {
            "id": "4974d6f3-f1aa-598b-b90e-f0180e0a55c4",
            "name": "데모 서비스 1",
            "role": "API 및 데이터 모델 개발",
            "start": "2023.01",
            "end": "2023.06",
            "description": "개발용 합성 본문",
            "url": ""
          },
          {
            "id": "964450db-ae6e-5ee0-9505-96917f2b498e",
            "name": "데모 서비스 2",
            "role": "API 및 데이터 모델 개발",
            "start": "2023.01",
            "end": "2023.06",
            "description": "개발용 합성 본문",
            "url": ""
          }
        ]
      }
    ]
    $content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
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
        "type": "experience",
        "hidden": true,
        "items": [
          {
            "id": "222924cb-4d19-565a-9340-b21ce6d20397",
            "company": "",
            "position": "",
            "start": "",
            "end": "",
            "current": false,
            "description": ""
          }
        ]
      }
    ]
    $content$::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
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
          "jobTitle": "백엔드 개발자",
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
    FALSE
FROM users u
WHERE u.email = 'minjun@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
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
          "jobTitle": "백엔드 개발자",
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
    TRUE
FROM users u
WHERE u.email = 'seoyeon@resume.dev';


UPDATE resume
SET content = jsonb_set(
    content,
    '{2,items,0,description}',
    to_jsonb($body$- 사용자 입력을 안전하게 처리하고 서비스 데이터를 PostgreSQL에 저장했습니다.
- API 요청의 실패 원인을 분석하고 테스트로 재현하여 안정성을 높였습니다.
- 검색 쿼리와 인덱스를 검토하고 응답 시간을 개선했습니다.
- 배포 절차를 문서화하고 팀원이 동일한 환경에서 서비스를 실행하도록 구성했습니다.
- 사용자 입력을 안전하게 처리하고 서비스 데이터를 PostgreSQL에 저장했습니다.
- API 요청의 실패 원인을 분석하고 테스트로 재현하여 안정성을 높였습니다.
- 검색 쿼리와 인덱스를 검토하고 응답 시간을 개선했습니다.
- 배포 절차를 문서화하고 팀원이 동일한 환경에서 서비스를 실행하도록 구성했습니다.
- 사용자 입력을 안전하게 처리하고 서비스 데이터를 PostgreSQL에 저장했습니다.
- API 요청의 실패 원인을 분석하고 테스트로 재현하여 안정성을 높였습니다.
- 검색 쿼리와 인덱스를 검토하고 응답 시간을 개선했습니다.
- 배포 절차를 문서화하고 팀원이 동일한 환경에서 서비스를 실행하도록 구성했습니다.
$body$::TEXT)
)
WHERE title = '백엔드 개발자 이력서'
    AND user_id = (
        SELECT u.id
        FROM users u
        WHERE u.email = 'jiwoo@resume.dev'
    );

UPDATE resume
SET content = jsonb_set(
    content,
    '{5,items,0,description}',
    to_jsonb($body$- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
$body$::TEXT)
)
WHERE title = '백엔드 개발자 이력서'
    AND user_id = (
        SELECT u.id
        FROM users u
        WHERE u.email = 'jiwoo@resume.dev'
    );

UPDATE resume
SET content = jsonb_set(
    content,
    '{5,items,1,description}',
    to_jsonb($body$- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
$body$::TEXT)
)
WHERE title = '백엔드 개발자 이력서'
    AND user_id = (
        SELECT u.id
        FROM users u
        WHERE u.email = 'jiwoo@resume.dev'
    );

UPDATE resume
SET content = jsonb_set(
    content,
    '{5,items,2,description}',
    to_jsonb($body$- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
$body$::TEXT)
)
WHERE title = '백엔드 개발자 이력서'
    AND user_id = (
        SELECT u.id
        FROM users u
        WHERE u.email = 'jiwoo@resume.dev'
    );

UPDATE resume
SET content = jsonb_set(
    content,
    '{4,items,0,description}',
    to_jsonb($body$- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
$body$::TEXT)
)
WHERE title = '신입 지원용'
    AND user_id = (
        SELECT u.id
        FROM users u
        WHERE u.email = 'jiwoo@resume.dev'
    );

UPDATE resume
SET content = jsonb_set(
    content,
    '{4,items,1,description}',
    to_jsonb($body$- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.
- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.
- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.
$body$::TEXT)
)
WHERE title = '신입 지원용'
    AND user_id = (
        SELECT u.id
        FROM users u
        WHERE u.email = 'jiwoo@resume.dev'
    );
