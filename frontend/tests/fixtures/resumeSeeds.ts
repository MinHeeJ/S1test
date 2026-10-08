// 합성 DB seed와 동일한 시험 전용 본문. 런타임에서 import하지 않는다.
export const resumeSeeds = [
  {
    title: "백엔드 개발자 이력서",
    template: "modern",
    style: {
      color: "#1F3A5F",
      font: "pretendard",
      size: "medium",
    },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "지우",
          jobTitle: "백엔드 개발자",
          email: "jiwoo@resume.dev",
          phone: "",
          links: [],
          photoId: null,
        },
      },
      {
        type: "summary",
        hidden: false,
        data: {
          headline: "안정적인 서비스를 만드는 개발자",
          body: "사용자 관점에서 문제를 정의하고 데이터와 테스트로 개선하는 합성 데모 이력서입니다.",
        },
      },
      {
        type: "experience",
        hidden: false,
        items: [
          {
            id: "16bed868-e995-58df-9ba7-c4c345a59135",
            company: "데모 서비스 연구소",
            position: "서버 개발자",
            start: "2021.03",
            end: "",
            current: true,
            description:
              "- 요구사항을 작은 처리 흐름으로 나누고 입력과 출력의 경계를 문서화했습니다.\n- 사용자 소유 데이터의 조회와 변경 조건을 통합하고 권한 경계를 검증했습니다.\n- 실제 PostgreSQL 환경에서 JSON 본문과 이미지 원본의 왕복을 검증했습니다.\n- 동시 요청과 중복 입력을 재현하여 데이터 제약과 트랜잭션의 역할을 확인했습니다.\n- 서비스 장애를 재현 가능한 테스트로 남기고 변경 전후의 동작을 비교했습니다.\n- 느린 조회를 분석하고 소유자와 수정 시간에 맞는 인덱스를 검토했습니다.\n- 배포 과정의 환경 설정을 문서화하고 비밀 정보가 이미지에 포함되지 않게 했습니다.\n- 오류 응답 형식을 맞추어 사용자가 다시 시도할 수 있도록 개선했습니다.\n- 이미지 업로드와 문서 연결을 분리하고 실패 후 기존 문서를 보존했습니다.\n- 작업 결과를 검토하며 테스트 누락과 경계 조건을 보완했습니다.\n- 작은 변경을 자주 배포하고 서비스의 관찰 결과로 다음 개선을 결정했습니다.\n- 사용자 피드백을 수집하고 접근성과 모바일 입력 흐름을 함께 검토했습니다.",
          },
        ],
      },
      {
        type: "education",
        hidden: false,
        items: [
          {
            id: "c8ce35c1-b3eb-57b8-961f-9a147c03b5e8",
            school: "데모대학교",
            major: "컴퓨터공학",
            degree: "학사",
            start: "2017.03",
            end: "2021.02",
            current: false,
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: {
          tags: ["Java", "Spring", "PostgreSQL", "TypeScript", "React"],
        },
      },
      {
        type: "projects",
        hidden: false,
        items: [
          {
            id: "12219ec8-5f30-5695-80c1-13a86e788d1a",
            name: "이력서 편집 서비스",
            role: "개발",
            start: "2023.01",
            end: "2023.12",
            description: "- 사용자 입력을 검증하고 데이터 흐름을 개선했습니다.",
            url: "",
          },
          {
            id: "76a4f2e9-5131-5e90-b608-b890205ceeb3",
            name: "문서 검색 서비스",
            role: "개발",
            start: "2023.01",
            end: "2023.12",
            description: "- 사용자 입력을 검증하고 데이터 흐름을 개선했습니다.",
            url: "",
          },
        ],
      },
      {
        type: "certificates",
        hidden: false,
        items: [
          {
            id: "af376d68-9057-5d38-9fbe-90e2eb416d2d",
            name: "정보처리기사",
            issuer: "데모 발급기관",
            date: "2021.06",
          },
        ],
      },
      {
        type: "languages",
        hidden: false,
        items: [
          {
            id: "4fd5e159-7f1b-5ec5-b241-e73828891d5e",
            language: "영어",
            test: "데모 시험",
            score: "업무 의사소통",
          },
        ],
      },
    ],
  },
  {
    title: "신입 지원용",
    template: "classic",
    style: {
      color: "#2563EB",
      font: "pretendard",
      size: "medium",
    },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "지우",
          jobTitle: "백엔드 개발자",
          email: "jiwoo@resume.dev",
          phone: "",
          links: [],
          photoId: null,
        },
      },
      {
        type: "summary",
        hidden: false,
        data: {
          headline: "신입 개발자",
          body: "프로젝트에서 배운 내용을 바탕으로 신뢰할 수 있는 서비스를 만들고 싶습니다.",
        },
      },
      {
        type: "education",
        hidden: false,
        items: [
          {
            id: "c8ce35c1-b3eb-57b8-961f-9a147c03b5e8",
            school: "데모대학교",
            major: "컴퓨터공학",
            degree: "학사",
            start: "2017.03",
            end: "2021.02",
            current: false,
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: {
          tags: ["Java", "Spring", "PostgreSQL", "TypeScript", "React"],
        },
      },
      {
        type: "projects",
        hidden: false,
        items: [
          {
            id: "12219ec8-5f30-5695-80c1-13a86e788d1a",
            name: "이력서 편집 서비스",
            role: "개발",
            start: "2023.01",
            end: "2023.12",
            description: "- 사용자 입력을 검증하고 데이터 흐름을 개선했습니다.",
            url: "",
          },
          {
            id: "76a4f2e9-5131-5e90-b608-b890205ceeb3",
            name: "문서 검색 서비스",
            role: "개발",
            start: "2023.01",
            end: "2023.12",
            description: "- 사용자 입력을 검증하고 데이터 흐름을 개선했습니다.",
            url: "",
          },
        ],
      },
    ],
  },
  {
    title: "작성 중인 이력서",
    template: "classic",
    style: {
      color: "#374151",
      font: "pretendard",
      size: "medium",
    },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "지우",
          jobTitle: "",
          email: "jiwoo@resume.dev",
          phone: "",
          links: [],
          photoId: null,
        },
      },
      {
        type: "experience",
        hidden: true,
        items: [
          {
            id: "616436fc-023f-5463-9fcf-48a2598c94cf",
            company: "",
            position: "",
            start: "",
            end: "",
            current: false,
            description: "",
          },
        ],
      },
    ],
  },
  {
    title: "민준 이력서",
    template: "classic",
    style: {
      color: "#1F3A5F",
      font: "pretendard",
      size: "medium",
    },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "민준",
          jobTitle: "백엔드 개발자",
          email: "minjun@resume.dev",
          phone: "",
          links: [],
          photoId: null,
        },
      },
    ],
  },
  {
    title: "서연 이력서",
    template: "classic",
    style: {
      color: "#1F3A5F",
      font: "pretendard",
      size: "medium",
    },
    content: [
      {
        type: "basics",
        hidden: false,
        data: {
          name: "서연",
          jobTitle: "백엔드 개발자",
          email: "seoyeon@resume.dev",
          phone: "",
          links: [],
          photoId: null,
        },
      },
    ],
  },
] as const;
