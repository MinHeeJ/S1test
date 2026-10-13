-- 사진 없는 합성 데모 fixture. 실제 고객 데이터가 아니며 점수/페이지 수는 저장하지 않는다.
INSERT INTO users (email, nickname, password_hash)
VALUES ('jiwoo@resume.dev', '지우', '$2b$12$tJKzEU4K8nb6QK5holNOKeDS.wo.38V.L684WWx2GkGfecPybSNUe');

INSERT INTO users (email, nickname, password_hash)
VALUES ('minjun@resume.dev', '민준', '$2b$12$tJKzEU4K8nb6QK5holNOKeDS.wo.38V.L684WWx2GkGfecPybSNUe');

INSERT INTO users (email, nickname, password_hash)
VALUES ('seoyeon@resume.dev', '서연', '$2b$12$tJKzEU4K8nb6QK5holNOKeDS.wo.38V.L684WWx2GkGfecPybSNUe');

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '백엔드 개발자 이력서',
    'modern',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    (
        $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
  $content$ ||
        $content$    "jobTitle": "백엔드 개발자",
      "email": "jiwoo@resume.dev",
      "phone": "",
    $content$ ||
        $content$  "links": [],
      "photoId": null
    }
  },
  {
    "type": "summary",
    "hidde$content$ ||
        $content$n": false,
    "data": {
      "headline": "합성 데모 소개",
      "body": "서비스 설계와 검증을 경험한$content$ ||
        $content$ 개발자 데모 이력서입니다."
    }
  },
  {
    "type": "experience",
    "hidden": false,
    "i$content$ ||
        $content$tems": [
      {
        "id": "993d6755-76c9-4899-8b20-3c0364a6c320",
        "compa$content$ ||
        $content$ny": "데모 개발사 1",
        "position": "개발자",
        "start": "2020.01",
        "end"$content$ ||
        $content$: "2023.12",
        "current": false,
        "description": "- 데모 업무 1: 이 문장은 실제 고객$content$ ||
        $content$ 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 2: 이 문장은 실제 고객 경력이 아닌 합$content$ ||
        $content$성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 3: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입$content$ ||
        $content$니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 4: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설$content$ ||
        $content$계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 5: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개$content$ ||
        $content$선 과정의 결과를 설명합니다.\n- 데모 업무 6: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를$content$ ||
        $content$ 설명합니다.\n- 데모 업무 7: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n$content$ ||
        $content$- 데모 업무 8: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 9$content$ ||
        $content$: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 10: 이 문장은 $content$ ||
        $content$실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 11: 이 문장은 실제 고객 경력$content$ ||
        $content$이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 12: 이 문장은 실제 고객 경력이 아닌 합성 $content$ ||
        $content$이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다."
      },
      {
        "id": "c9354204-2$content$ ||
        $content$2d5-4211-a0bf-7ce0b51a0a13",
        "company": "데모 개발사 2",
        "position": "개발자"$content$ ||
        $content$,
        "start": "2020.01",
        "end": "2023.12",
        "current": false,
   $content$ ||
        $content$     "description": "- 데모 업무 1: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 $content$ ||
        $content$결과를 설명합니다.\n- 데모 업무 2: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다$content$ ||
        $content$.\n- 데모 업무 3: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업$content$ ||
        $content$무 4: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 5: 이 문장$content$ ||
        $content$은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 6: 이 문장은 실제 고객 경$content$ ||
        $content$력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 7: 이 문장은 실제 고객 경력이 아닌 합성 $content$ ||
        $content$이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 8: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다$content$ ||
        $content$. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 9: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계,$content$ ||
        $content$ 검증 및 개선 과정의 결과를 설명합니다.\n- 데모 업무 10: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선$content$ ||
        $content$ 과정의 결과를 설명합니다.\n- 데모 업무 11: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를$content$ ||
        $content$ 설명합니다.\n- 데모 업무 12: 이 문장은 실제 고객 경력이 아닌 합성 이력서 예시입니다. 서비스 설계, 검증 및 개선 과정의 결과를 설명합니다."$content$ ||
        $content$
      }
    ]
  },
  {
    "type": "education",
    "hidden": false,
    "items": [
$content$ ||
        $content$      {
        "id": "bbe7757b-f5e1-4536-94cf-0ce9601fbb4f",
        "school": "데모 대$content$ ||
        $content$학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2016.03",
  $content$ ||
        $content$      "end": "2020.02",
        "current": false
      }
    ]
  },
  {
    "type": "$content$ ||
        $content$skills",
    "hidden": false,
    "data": {
      "tags": [
        "Java",
        "$content$ ||
        $content$Spring",
        "PostgreSQL",
        "TypeScript",
        "Docker"
      ]
    }
 $content$ ||
        $content$ },
  {
    "type": "projects",
    "hidden": false,
    "items": [
      {
        "$content$ ||
        $content$id": "439dddea-d2e6-4347-a7cb-057302367240",
        "name": "데모 서비스",
        "role"$content$ ||
        $content$: "개발",
        "start": "2022.01",
        "end": "2023.12",
        "description": $content$ ||
        $content$"- 합성 프로젝트의 설계와 구현\n- 자동화 검증 및 배포 개선",
        "url": ""
      }
    ]
  },
  {
    "$content$ ||
        $content$type": "certificates",
    "hidden": false,
    "items": [
      {
        "id": "ff6$content$ ||
        $content$3c7f3-5e15-493c-ad1c-db7e243e41ad",
        "name": "데모 자격증",
        "issuer": "데모 발$content$ ||
        $content$급기관",
        "date": "2021.01"
      }
    ]
  },
  {
    "type": "languages",
    "$content$ ||
        $content$hidden": false,
    "items": [
      {
        "id": "404c18bf-d014-44cd-a516-6555e5e$content$ ||
        $content$730e4",
        "language": "영어",
        "test": "데모 평가",
        "score": "합성 점수"
 $content$ ||
        $content$     }
    ]
  }
]$content$
    )::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '신입 지원용',
    'classic',
    '{"color": "#2563EB", "font": "pretendard", "size": "medium"}'::jsonb,
    (
        $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
  $content$ ||
        $content$    "jobTitle": "신입 개발자",
      "email": "jiwoo@resume.dev",
      "phone": "",
     $content$ ||
        $content$ "links": [],
      "photoId": null
    }
  },
  {
    "type": "summary",
    "hidden$content$ ||
        $content$": false,
    "data": {
      "headline": "합성 신입 소개",
      "body": "학습과 프로젝트 경험을 정리한$content$ ||
        $content$ 합성 데모입니다."
    }
  },
  {
    "type": "education",
    "hidden": false,
    "items":$content$ ||
        $content$ [
      {
        "id": "4b676398-f84d-4275-8c46-d0bf48f7fafa",
        "school": "데$content$ ||
        $content$모 대학교",
        "major": "컴퓨터공학",
        "degree": "학사",
        "start": "2020.03",$content$ ||
        $content$
        "end": "2024.02",
        "current": false
      }
    ]
  },
  {
    "type"$content$ ||
        $content$: "skills",
    "hidden": false,
    "data": {
      "tags": [
        "Java",
      $content$ ||
        $content$  "SQL",
        "React",
        "Git",
        "Linux"
      ]
    }
  },
  {
    "$content$ ||
        $content$type": "projects",
    "hidden": false,
    "items": [
      {
        "id": "27cad19$content$ ||
        $content$f-5e3a-422e-b9eb-197b1d872b0d",
        "name": "데모 학습 프로젝트 1",
        "role": "개발",$content$ ||
        $content$
        "start": "2023.01",
        "end": "2023.12",
        "description": "- 합성 학$content$ ||
        $content$습 프로젝트",
        "url": ""
      },
      {
        "id": "a5546309-8ab3-414a-97ce-ac$content$ ||
        $content$2cfd1990ae",
        "name": "데모 학습 프로젝트 2",
        "role": "개발",
        "start": "$content$ ||
        $content$2023.01",
        "end": "2023.12",
        "description": "- 합성 학습 프로젝트",
        "u$content$ ||
        $content$rl": ""
      }
    ]
  }
]$content$
    )::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '작성 중인 이력서',
    'classic',
    '{"color": "#374151", "font": "pretendard", "size": "medium"}'::jsonb,
    (
        $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "지우",
  $content$ ||
        $content$    "jobTitle": "",
      "email": "jiwoo@resume.dev",
      "phone": "",
      "link$content$ ||
        $content$s": [],
      "photoId": null
    }
  },
  {
    "type": "experience",
    "hidden": $content$ ||
        $content$true,
    "items": [
      {
        "id": "f0fa64ab-d114-430c-b012-646d54ba5759",
  $content$ ||
        $content$      "company": "",
        "position": "",
        "start": "",
        "end": "",
$content$ ||
        $content$        "current": false,
        "description": ""
      }
    ]
  }
]$content$
    )::jsonb,
    FALSE
FROM users u
WHERE u.email = 'jiwoo@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '민준 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    (
        $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "민준",
  $content$ ||
        $content$    "jobTitle": "",
      "email": "minjun@resume.dev",
      "phone": "",
      "lin$content$ ||
        $content$ks": [],
      "photoId": null
    }
  }
]$content$
    )::jsonb,
    FALSE
FROM users u
WHERE u.email = 'minjun@resume.dev';

INSERT INTO resume (user_id, title, template, style, content, deleted)
SELECT
    u.id,
    '서연 이력서',
    'classic',
    '{"color": "#1F3A5F", "font": "pretendard", "size": "medium"}'::jsonb,
    (
        $content$[
  {
    "type": "basics",
    "hidden": false,
    "data": {
      "name": "서연",
  $content$ ||
        $content$    "jobTitle": "",
      "email": "seoyeon@resume.dev",
      "phone": "",
      "li$content$ ||
        $content$nks": [],
      "photoId": null
    }
  }
]$content$
    )::jsonb,
    TRUE
FROM users u
WHERE u.email = 'seoyeon@resume.dev';
