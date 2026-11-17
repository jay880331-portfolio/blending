import type { MemberSnapshot } from "@/domain/member/types";

const images = {
  avatar:
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
  latte:
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
  darkBlend:
    "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=900&q=80",
  oatLatte:
    "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=80",
  coldBrew:
    "https://images.unsplash.com/photo-1494415859740-21e878dd929d?auto=format&fit=crop&w=900&q=80",
  lab: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80",
  barista:
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=900&q=80",
};

export const memberMock: MemberSnapshot = {
  profile: {
    id: "kim-bari",
    name: "김바리",
    handle: "kim_bari_coffee",
    role: "barista",
    avatarUrl: images.avatar,
    online: true,
    status: "guest",
    workplace: "카페 스테이",
    workplaces: ["카페 스테이", "라떼커피랩", "브루잉 스튜디오"],
    specialties: ["에스프레소", "라떼아트", "브루잉"],
    bio: "저는 어릴때부터 커피를 시작해왔죠. 커피는 잘 마시는 못합니다 사실. 대신 추출 변수와 손님 경험을 집요하게 관찰하고, 작은 레시피 차이를 기록하는 일을 좋아합니다.",
    favoriteCount: 3240,
    isPortfolioPublic: true,
    certificateName: "SCA Barista Skills Professional",
    officialBadges: [],
    baristaProfile: {
      contactPhone: "010-1234-5678",
      employmentTypes: ["정규직"],
      totalExperience: "3~5년",
      certificateFileUrls: [],
      espressoMachineBrands: ["라마르조꼬(La Marzocco)"],
      espressoMachineBrandOther: "",
      grinderBrands: ["말코닉(Mahlkonig)"],
      grinderBrandOther: "",
      roasterBrands: ["스트롱홀드(Stronghold)"],
      roasterBrandOther: "",
      preferredBeans: "에티오피아 내추럴",
      preferredBeanNotes: ["산미", "단맛"],
    },
    isOwnProfile: true,
    socials: {
      instagram: "@kim_bari_coffee",
      threads: "@kim_bari_threads",
      website: "blog.naver.com/kimbari",
      recipeUrl: "/home/recipes",
    },
  },
  account: {
    phone: "010-0000-0000",
    country: "대한민국",
    identityVerified: true,
  },
  careers: [
    {
      id: "current",
      type: "career",
      year: "2025",
      period: "2025 - 현재",
      title: "라떼커피샵 바리스타",
      organization: "라떼커피샵",
      detail:
        "시그니처 음료 운영과 신입 바리스타 추출 교육을 담당하고 있습니다.",
      current: true,
    },
    {
      id: "award-2024",
      type: "award",
      year: "2024",
      period: "2024.01 - 2024.12",
      title: "바리스타 대회 우승",
      organization: "블렌딩 바리스타 챔피언십",
      detail:
        "우유 스티밍 안정성과 시그니처 음료 완성도로 파이널 라운드 1위를 기록했습니다.",
    },
    {
      id: "lead-2023",
      type: "career",
      year: "2023",
      period: "2023.01 - 2023.12",
      title: "수석 바리스타",
      organization: "카페 스테이",
      detail: "메뉴 개발 및 스태프 교육, 매장 품질 관리 총괄 및 재고 관리.",
      description:
        "메뉴 개발 및 스태프 교육, 매장 품질 관리 총괄 및 재고 관리.",
    },
    {
      id: "award-2022",
      type: "award",
      year: "2022",
      period: "2022.08",
      title: "라떼아트 세미나 베스트 데모",
      organization: "서울 커피 교육 협회",
      detail:
        "실습형 세미나에서 안정적인 밀크 스티밍과 하트 패턴 시연으로 베스트 데모에 선정되었습니다.",
    },
    {
      id: "junior-2021",
      type: "career",
      year: "2021",
      period: "2021.03 - 2022.12",
      title: "주니어 바리스타",
      organization: "브루잉 스튜디오",
      detail:
        "핸드드립 바 운영과 원두 재고 정리, 고객 취향 기록을 담당했습니다.",
      description:
        "핸드드립 바 운영과 원두 재고 정리, 고객 취향 기록을 담당했습니다.",
    },
  ],
  portfolios: [
    {
      id: "espresso-minimalism",
      title: "커피 미니멀리즘 연구",
      createdAt: "2026.05.06 12:30",
      summary:
        "다양한 원두의 특성에 맞춘 최적의 에스프레소 추출 레시피를 개발하는 프로젝트입니다. 온도, 분쇄도, 압력 등의 변인을 통제하며 일관된 맛을 낼 수 있는 프로파일을 완성했습니다.",
      imageUrls: [images.lab, images.darkBlend, images.latte],
    },
    {
      id: "signature-blend",
      title: "시그니처 블렌딩 개발",
      createdAt: "2026.04.18 09:10",
      summary:
        "새로운 시그니처 빨리 쓰기 위해 아무거나 써온 연구 과정 기록 및 터 정리입니다.",
      imageUrls: [images.latte],
    },
    {
      id: "specialty-class",
      title: "스페셜티 커피 클래스",
      createdAt: "2026.03.02 14:00",
      summary:
        "여름 시즌 한정 무엇인지요 테스트 및 부재료 믹지 공유를 정리했습니다.",
      imageUrls: [images.barista],
    },
  ],
  notifications: [
    {
      id: "comment-1",
      kind: "comment",
      title: "김바리님이 내 게시글에 댓글을 남겼습니다.",
      createdAgo: "1시간 전",
      unread: true,
    },
    {
      id: "like-1",
      kind: "like",
      title: "이바리님 외 3명이 내 레시피를 좋아합니다.",
      createdAgo: "3시간 전",
      unread: false,
    },
    {
      id: "notice-1",
      kind: "notice",
      title: "[공지] 서비스 점검 안내",
      createdAgo: "1일 전",
      unread: false,
    },
  ],
  messages: [],
  chatRoomSettings: [],
  notificationSettings: {
    communityLikes: true,
    communityComments: true,
    communityReplies: true,
    interestActivity: true,
    eventUpdates: true,
    directMessage: true,
    accountSecurity: true,
    benefitsMarketing: false,
    nightNotifications: false,
    shareLocationForTimesale: false,
  },
  favorites: [
    {
      id: "coffeejoa",
      name: "커피좋아",
      specialties: [],
      bio: "커피를 사랑하는 홈카페 유저입니다.",
      favorited: false,
    },
    {
      id: "ebari",
      name: "이바리",
      role: "barista",
      specialties: ["라떼아트", "브루잉"],
      bio: "현직 바리스타입니다. 소통해요!",
      favorited: true,
    },
    {
      id: "origin-taster",
      name: "원두감별사",
      specialties: [],
      bio: "다양한 싱글 오리진 정보를 공유합니다.",
      favorited: false,
    },
    {
      id: "cafe-inholic",
      name: "카페인홀릭",
      role: "barista",
      specialties: ["커핑", "로스팅"],
      bio: "로스터리 카페 운영 중인 바리스타입니다.",
      favorited: false,
    },
  ],
  favoriteFollowers: [
    {
      id: "origin-taster",
      name: "원두감별사",
      specialties: [],
      bio: "다양한 싱글 오리진 정보를 공유합니다.",
      favorited: false,
    },
    {
      id: "cafe-inholic",
      name: "카페인홀릭",
      role: "barista",
      specialties: ["커핑", "로스팅"],
      bio: "로스터리 카페 운영 중인 바리스타입니다.",
      favorited: false,
    },
  ],
  recipes: [
    {
      id: "signature-dark",
      title: "시그니처 다크 블렌드",
      summary:
        "강렬한 바디감과 다크 초콜릿의 풍미가 느껴지는 에스프레소 레시피입니다.",
      createdAt: "2025.02.10",
      imageUrl: images.darkBlend,
      liked: false,
    },
    {
      id: "oat-latte",
      title: "부드러운 오트 라떼",
      summary:
        "오트 밀크의 고소함과 에스프레소의 조화를 극대화한 비건 라떼입니다.",
      createdAt: "2025.01.25",
      imageUrl: images.oatLatte,
      liked: false,
    },
    {
      id: "vanilla-cold",
      title: "콜드브루 바닐라 크림",
      summary:
        "12시간 추출한 콜드브루 위에 수제 바닐라 빈 크림을 얹은 달콤한 메뉴입니다.",
      createdAt: "2025.01.15",
      imageUrl: images.coldBrew,
      liked: false,
    },
  ],
  myActivities: [
    {
      id: "my-post-espresso-channeling",
      kind: "post",
      board: "Q&A",
      title: "에스프레소 채널링 현상이 계속 발생합니다. 도와주세요.",
      excerpt:
        "바텀리스 포터필터를 사용하기 시작했는데 추출할 때마다 사방으로 튀는 채널링 현상이 너무 심합니다.",
      createdAt: "2026.05.12",
      viewCount: 320,
      commentCount: 5,
      likeCount: 12,
      href: "/community/qa/espresso-channeling",
    },
    {
      id: "my-comment-espresso-channeling",
      kind: "comment",
      board: "Q&A",
      title: "에스프레소 채널링 현상이 계속 발생합니다. 도와주세요.",
      excerpt:
        "분쇄도를 굵게 할수록 시간이 너무 짧아지지 않을까요? 현재 18g으로 25초 정도 걸리는데 궁금합니다.",
      createdAt: "2026.05.12",
      viewCount: 320,
      commentCount: 5,
      href: "/community/qa/espresso-channeling",
    },
    {
      id: "my-recipe-signature-dark",
      kind: "post",
      board: "Recipe",
      title: "시그니처 다크 블렌드",
      excerpt:
        "강렬한 바디감과 다크 초콜릿의 풍미가 느껴지는 에스프레소 레시피입니다.",
      createdAt: "2025.02.10",
      viewCount: 2400,
      commentCount: 18,
      likeCount: 128,
      href: "/home/recipes",
    },
    {
      id: "my-review-seoul-coffee",
      kind: "post",
      board: "Event Review",
      title: "서울 커피 엑스포 2026 후기",
      excerpt:
        "코엑스에서 열린 서울 커피 엑스포에 다녀온 후기와 인상 깊었던 부스 기록입니다.",
      createdAt: "2026.04.15",
      likeCount: 24,
      href: "/community/reviews/expo-review-2026",
    },
  ],
  interests: [],
};
