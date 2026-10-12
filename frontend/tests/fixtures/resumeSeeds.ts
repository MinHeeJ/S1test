import type { Resume } from "../../src/domain/resume/types";

/** Mirrors synthetic migration content for pure-function and renderer tests only. */
export const resumeSeeds: Resume[] = [
  {
    id: "1",
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
          body: "이 문서는 실제 개인 정보가 아닌 개발용 합성 이력서입니다. 사용자 입력과 데이터 흐름을 이해하고 유지보수 가능한 서비스를 만드는 일에 관심이 있습니다.",
        },
      },
      {
        type: "experience",
        hidden: false,
        items: [
          {
            id: "f09d4931-f5eb-5f4b-a267-941ae4a0d447",
            company: "데모 기술 연구소",
            position: "백엔드 개발",
            start: "2022.03",
            end: "",
            current: true,
            description:
              "- 사용자 입력을 안전하게 처리하고 서비스 데이터를 PostgreSQL에 저장했습니다.\n- API 요청의 실패 원인을 분석하고 테스트로 재현하여 안정성을 높였습니다.\n- 검색 쿼리와 인덱스를 검토하고 응답 시간을 개선했습니다.\n- 배포 절차를 문서화하고 팀원이 동일한 환경에서 서비스를 실행하도록 구성했습니다.\n- 사용자 입력을 안전하게 처리하고 서비스 데이터를 PostgreSQL에 저장했습니다.\n- API 요청의 실패 원인을 분석하고 테스트로 재현하여 안정성을 높였습니다.\n- 검색 쿼리와 인덱스를 검토하고 응답 시간을 개선했습니다.\n- 배포 절차를 문서화하고 팀원이 동일한 환경에서 서비스를 실행하도록 구성했습니다.\n- 사용자 입력을 안전하게 처리하고 서비스 데이터를 PostgreSQL에 저장했습니다.\n- API 요청의 실패 원인을 분석하고 테스트로 재현하여 안정성을 높였습니다.\n- 검색 쿼리와 인덱스를 검토하고 응답 시간을 개선했습니다.\n- 배포 절차를 문서화하고 팀원이 동일한 환경에서 서비스를 실행하도록 구성했습니다.",
          },
        ],
      },
      {
        type: "education",
        hidden: false,
        items: [
          {
            id: "d99ca6e8-edb6-55c8-ab68-ca4a84df44a1",
            school: "데모대학교",
            major: "컴퓨터공학",
            degree: "학사",
            start: "2018.03",
            end: "2022.02",
            current: false,
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: {
          tags: ["Java", "Spring", "PostgreSQL", "Docker", "TypeScript"],
        },
      },
      {
        type: "projects",
        hidden: false,
        items: [
          {
            id: "4974d6f3-f1aa-598b-b90e-f0180e0a55c4",
            name: "데모 서비스 1",
            role: "API 및 데이터 모델 개발",
            start: "2023.01",
            end: "2023.06",
            description:
              "- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.\n- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.",
            url: "",
          },
          {
            id: "964450db-ae6e-5ee0-9505-96917f2b498e",
            name: "데모 서비스 2",
            role: "API 및 데이터 모델 개발",
            start: "2023.01",
            end: "2023.06",
            description:
              "- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.\n- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.",
            url: "",
          },
          {
            id: "3ce2b3fc-5e0a-56de-9dd0-a399a60f0d97",
            name: "데모 서비스 3",
            role: "API 및 데이터 모델 개발",
            start: "2023.01",
            end: "2023.06",
            description:
              "- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.\n- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.",
            url: "",
          },
        ],
      },
      {
        type: "certificates",
        hidden: false,
        items: [
          {
            id: "a7bb77fc-7bbb-594a-8c3e-327a57f80301",
            name: "데모 정보처리 자격",
            issuer: "데모 평가 기관",
            date: "2022.05",
          },
        ],
      },
      {
        type: "languages",
        hidden: false,
        items: [
          {
            id: "7cdc63a3-837c-55a2-ac4f-a04a852e7f33",
            language: "영어",
            test: "데모 어학 평가",
            score: "업무 문서 독해",
          },
        ],
      },
    ],
  },
  {
    id: "2",
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
          headline: "신입 개발자 지원",
          body: "개발용 합성 문서입니다. 프로젝트로 협업과 API 개발 경험을 쌓았습니다.",
        },
      },
      {
        type: "education",
        hidden: false,
        items: [
          {
            id: "d99ca6e8-edb6-55c8-ab68-ca4a84df44a1",
            school: "데모대학교",
            major: "컴퓨터공학",
            degree: "학사",
            start: "2018.03",
            end: "2022.02",
            current: false,
          },
        ],
      },
      {
        type: "skills",
        hidden: false,
        data: {
          tags: ["Java", "Spring", "SQL", "Git", "React"],
        },
      },
      {
        type: "projects",
        hidden: false,
        items: [
          {
            id: "4974d6f3-f1aa-598b-b90e-f0180e0a55c4",
            name: "데모 서비스 1",
            role: "API 및 데이터 모델 개발",
            start: "2023.01",
            end: "2023.06",
            description:
              "- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.\n- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.",
            url: "",
          },
          {
            id: "964450db-ae6e-5ee0-9505-96917f2b498e",
            name: "데모 서비스 2",
            role: "API 및 데이터 모델 개발",
            start: "2023.01",
            end: "2023.06",
            description:
              "- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.\n- 사용자 관점에서 입력 흐름과 예외 상황을 정리했습니다.\n- 세션 인증과 소유권 검사를 구현하여 다른 사용자 데이터 접근을 차단했습니다.\n- 자동화된 테스트와 배포 문서로 변경 이후 동작을 확인했습니다.",
            url: "",
          },
        ],
      },
    ],
  },
  {
    id: "3",
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
            id: "222924cb-4d19-565a-9340-b21ce6d20397",
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
    id: "4",
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
      {
        type: "summary",
        hidden: false,
        data: {
          headline: "",
          body: "",
        },
      },
      {
        type: "experience",
        hidden: false,
        items: [],
      },
      {
        type: "education",
        hidden: false,
        items: [],
      },
      {
        type: "skills",
        hidden: false,
        data: {
          tags: [],
        },
      },
    ],
  },
  {
    id: "5",
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
      {
        type: "summary",
        hidden: false,
        data: {
          headline: "",
          body: "",
        },
      },
      {
        type: "experience",
        hidden: false,
        items: [],
      },
      {
        type: "education",
        hidden: false,
        items: [],
      },
      {
        type: "skills",
        hidden: false,
        data: {
          tags: [],
        },
      },
    ],
  },
];
