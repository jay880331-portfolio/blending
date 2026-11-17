import type {
  CommunityEvent,
  EventReview,
  CommunitySnapshot,
} from "@/domain/community/types";

const roastCycle = ["dark", "medium", "light"] as const;

const coffeeImages = {
  latte:
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
  espresso:
    "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=900&q=80",
  beans:
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80",
  dripper:
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  barista:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  brew: "https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=900&q=80",
  cup: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
  poster:
    "https://images.unsplash.com/photo-1445077100181-a33e9ac94db0?auto=format&fit=crop&w=900&q=80",
  signature:
    "https://images.unsplash.com/photo-1522992319-0365e5f11656?auto=format&fit=crop&w=900&q=80",
  qna: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80",
  flower:
    "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80",
};

const extraEventTitles = [
  "브루잉 센서리 트레이닝",
  "카페 메뉴 개발 워크숍",
  "라떼아트 베이직 클래스",
  "스페셜티 생두 커핑",
  "로스터리 오픈 토크",
  "에스프레소 변수 실험실",
  "커피 장비 유지관리 세미나",
  "콜드브루 여름 메뉴 연구",
  "핸드드립 레시피 교환회",
  "디저트 페어링 모임",
];

const extraEventLocations = [
  "Seoul, Yeonnam",
  "Busan, Jeonpo",
  "Daegu Coffee Lab",
  "Daejeon Roastery",
  "Gwangju Brew Studio",
  "Jeju Training Bar",
];

const extraCommunityEvents: CommunityEvent[] = Array.from(
  { length: 42 },
  (_, index) => {
    const categories = ["official", "seminar", "meetup"] as const;
    const imageKeys = [
      "latte",
      "espresso",
      "beans",
      "dripper",
      "barista",
      "brew",
      "cup",
    ] as const;
    const category = categories[index % categories.length];
    const image = coffeeImages[imageKeys[index % imageKeys.length]];
    const day = 18 + index;
    const startsAt = new Date(Date.UTC(2026, 5, day, 4 + (index % 7), 0, 0));
    const endsAt = new Date(
      startsAt.getTime() + (2 + (index % 3)) * 60 * 60 * 1000,
    );

    return {
      id: `mock-event-${String(index + 1).padStart(2, "0")}`,
      title: extraEventTitles[index % extraEventTitles.length],
      category,
      startsAt: startsAt.toISOString().replace(".000Z", "+09:00"),
      endsAt: endsAt.toISOString().replace(".000Z", "+09:00"),
      location: extraEventLocations[index % extraEventLocations.length],
      address: extraEventLocations[index % extraEventLocations.length],
      imageUrl: image,
      posterUrl: image,
      description:
        "페이지네이션과 일정 목록 상태를 확인하기 위한 목업 일정입니다. 실제 운영 데이터처럼 카테고리, 시간, 장소가 번갈아 보이도록 구성했습니다.",
    };
  },
);

const extraReviewTitles = [
  "세미나 실습 동선이 좋았던 날",
  "커핑 노트가 또렷했던 워크숍",
  "초보자도 따라가기 쉬운 추출 클래스",
  "장비 비교가 유익했던 모임",
  "로스팅 프로파일 이해가 쉬웠던 세션",
  "운영자가 꼼꼼했던 커피 클래스",
  "다시 참여하고 싶은 브루잉 모임",
  "현장 피드백이 빠른 세미나 후기",
];

const extraCommunityReviews: EventReview[] = Array.from(
  { length: 52 },
  (_, index) => {
    const categories = ["official", "seminar", "meetup"] as const;
    const imageKeys = [
      "latte",
      "espresso",
      "beans",
      "dripper",
      "barista",
      "brew",
      "cup",
    ] as const;
    const category = categories[index % categories.length];
    const createdAt = new Date(
      Date.UTC(2026, 4, 18 - (index % 18), 3 + (index % 9), 30, 0),
    );

    return {
      id: `mock-review-${String(index + 1).padStart(2, "0")}`,
      eventId:
        index % 2 === 0 ? "espresso-extraction-101" : "green-bean-evaluation",
      title: extraReviewTitles[index % extraReviewTitles.length],
      category,
      author: {
        name: `reviewer_${String(index + 1).padStart(2, "0")}`,
        handle: `reviewer_${String(index + 1).padStart(2, "0")}`,
      },
      createdAt: createdAt.toISOString().replace(".000Z", "+09:00"),
      imageUrls: [
        coffeeImages[imageKeys[index % imageKeys.length]],
        coffeeImages[imageKeys[(index + 2) % imageKeys.length]],
      ],
      keywords: ["#유익함", "#실습위주", "#추천", "#커피모임"].slice(
        0,
        2 + (index % 3),
      ),
      likes: 48 + index * 7,
      body: "페이지네이션과 리뷰 목록 UI를 확인하기 위한 목업 후기입니다. 이미지, 키워드, 좋아요 수가 반복되지 않도록 구성했습니다.",
    };
  },
);

export const communityMock: CommunitySnapshot = {
  events: [
    {
      id: "seoul-barista-2026",
      title: "2026 서울 바리스타 챔피언십",
      category: "official",
      startsAt: "2026-05-14T10:00:00+09:00",
      endsAt: "2026-05-16T18:00:00+09:00",
      location: "COEX Exhibition Center",
      address: "Seoul, South Korea",
      imageUrl: coffeeImages.latte,
      posterUrl: coffeeImages.poster,
      description:
        "대한민국 최고의 커피 장인을 가리는 무대입니다. 지속 가능한 커피의 미래를 주제로, 참가자들의 창의적인 에스프레소 블렌딩과 시그니처 음료를 직접 확인할 수 있습니다.",
      applyUrl:
        "mailto:manager@blending.example?subject=2026%20서울%20바리스타%20챔피언십",
    },
    {
      id: "roasting-basics-seminar",
      title: "Roasting Basics Seminar",
      category: "seminar",
      startsAt: "2026-05-15T10:00:00+09:00",
      endsAt: "2026-05-15T12:00:00+09:00",
      location: "Gangnam Roastery",
      address: "Seoul, Gangnam-gu",
      imageUrl: coffeeImages.beans,
      posterUrl: coffeeImages.beans,
      description:
        "로스팅 입문자를 위한 세미나입니다. 프로파일 설계, 1차 크랙 전후의 향미 변화, 샘플 로스팅 기록법을 함께 다룹니다.",
      applyUrl: "https://example.com/roasting-basics",
    },
    {
      id: "hand-drip-workshop",
      title: "Hand Drip Workshop",
      category: "meetup",
      startsAt: "2026-05-17T11:00:00+09:00",
      endsAt: "2026-05-17T13:00:00+09:00",
      location: "Itaewon Studio",
      address: "Seoul, Yongsan-gu",
      imageUrl: coffeeImages.dripper,
      posterUrl: coffeeImages.dripper,
      description:
        "서로의 추출 루틴을 공유하고, 물줄기와 분쇄도 차이가 컵에 남기는 변화를 비교하는 소규모 모임입니다.",
      applyUrl: "https://example.com/hand-drip",
    },
    {
      id: "espresso-extraction-101",
      title: "Espresso Extraction 101",
      category: "seminar",
      startsAt: "2026-05-19T15:00:00+09:00",
      endsAt: "2026-05-19T17:00:00+09:00",
      location: "Seongsu Training Lab",
      address: "Seoul, Seongsu-dong",
      imageUrl: coffeeImages.espresso,
      posterUrl: coffeeImages.espresso,
      description:
        "채널링, 레벨링, 탬핑 압력의 차이를 실습하면서 안정적인 에스프레소 추출 기준을 잡습니다.",
    },
    {
      id: "green-bean-evaluation",
      title: "Green Bean Evaluation",
      category: "official",
      startsAt: "2026-05-20T10:00:00+09:00",
      endsAt: "2026-05-20T12:00:00+09:00",
      location: "Head Office",
      address: "Seoul, Jung-gu",
      imageUrl: coffeeImages.cup,
      posterUrl: coffeeImages.cup,
      description:
        "공식 커핑 세션입니다. 새로 입고된 생두의 결점두 비율과 향미 잠재력을 평가합니다.",
    },
    {
      id: "sustainability-talk",
      title: "Sustainability Talk",
      category: "meetup",
      startsAt: "2026-05-22T19:00:00+09:00",
      endsAt: "2026-05-22T21:00:00+09:00",
      location: "Seoul Station Branch",
      address: "Seoul, Jung-gu",
      imageUrl: coffeeImages.barista,
      posterUrl: coffeeImages.barista,
      description:
        "커피 산업의 지속 가능성을 주제로, 카페 운영자와 바리스타가 각자의 실천 사례를 공유합니다.",
    },
    {
      id: "siphon-brewing",
      title: "Siphon Brewing",
      category: "official",
      startsAt: "2026-05-25T13:00:00+09:00",
      endsAt: "2026-05-25T15:00:00+09:00",
      location: "Incheon, Songdo",
      address: "Incheon, Songdo",
      imageUrl: coffeeImages.brew,
      posterUrl: coffeeImages.brew,
      description:
        "사이폰 브루잉의 열원 제어와 교반 변수를 집중적으로 다루는 공식 워크숍입니다.",
    },
    {
      id: "direct-trade-seminar",
      title: "Direct Trade Seminar",
      category: "seminar",
      startsAt: "2026-06-01T14:00:00+09:00",
      endsAt: "2026-06-01T16:30:00+09:00",
      location: "Seoul, Seongdong-gu",
      address: "Seoul, Seongdong-gu",
      imageUrl: coffeeImages.beans,
      posterUrl: coffeeImages.beans,
      description:
        "농장과 로스터리의 직접 거래 사례를 통해 가격 투명성과 품질 관리 프로세스를 살펴봅니다.",
    },
    {
      id: "cold-brew-methods",
      title: "Cold Brew Methods",
      category: "meetup",
      startsAt: "2026-06-08T11:00:00+09:00",
      endsAt: "2026-06-08T13:00:00+09:00",
      location: "Busan, Gwangalli",
      address: "Busan, Gwangalli",
      imageUrl: coffeeImages.espresso,
      posterUrl: coffeeImages.espresso,
      description:
        "여름 메뉴를 준비하는 바리스타들이 콜드브루 레시피와 보관 방식을 비교하는 모임입니다.",
    },
    {
      id: "coffee-tech-fair",
      title: "Coffee Tech Fair",
      category: "official",
      startsAt: "2026-06-15T10:00:00+09:00",
      endsAt: "2026-06-15T18:00:00+09:00",
      location: "Seoul, Gangnam COEX",
      address: "Seoul, Gangnam-gu",
      imageUrl: coffeeImages.dripper,
      posterUrl: coffeeImages.dripper,
      description:
        "최신 그라인더, 머신, 수질 장비를 체험할 수 있는 공식 커피 테크 박람회입니다.",
    },
    ...extraCommunityEvents,
  ],
  reviews: [
    {
      id: "expo-review-2026",
      eventId: "seoul-barista-2026",
      title: "서울 커피 엑스포 2026 후기",
      category: "official",
      author: {
        name: "Barista_Kim",
        handle: "coffee_master",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      },
      createdAt: "2026-05-10T12:00:00+09:00",
      imageUrls: [
        coffeeImages.latte,
        coffeeImages.poster,
        coffeeImages.barista,
      ],
      keywords: [
        "#매우만족",
        "#유익함",
        "#재방문의사100%",
        "#커피맛집",
        "#공식행사",
      ],
      likes: 128,
      body: "올해도 어김없이 코엑스에서 열린 커피 엑스포에 다녀왔습니다. 작년보다 규모가 커졌고, 특히 스페셜티 커피 부스들이 눈에 띄게 늘어났습니다. 바리스타 챔피언십 결선은 긴장감과 완성도가 모두 높았습니다.",
    },
    {
      id: "latte-art-session",
      eventId: "hand-drip-workshop",
      title: "Great Latte Art session!",
      category: "seminar",
      author: {
        name: "barista_world",
        handle: "barista_world",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80",
      },
      createdAt: "2026-05-08T10:00:00+09:00",
      imageUrls: [coffeeImages.cup, coffeeImages.latte],
      keywords: ["#SkillUp", "#Fun"],
      likes: 95,
      body: "실습 시간이 충분해서 좋았습니다. 스팀 피처 각도와 유량 조절을 바로 피드백받을 수 있어 도움이 됐습니다.",
    },
    {
      id: "roasting-masterclass",
      eventId: "roasting-basics-seminar",
      title: "로스팅 마스터클래스 워크샵",
      category: "seminar",
      author: {
        name: "roasting_lab",
        handle: "roasting_lab",
      },
      createdAt: "2026-05-04T10:00:00+09:00",
      imageUrls: [coffeeImages.beans],
      keywords: ["#실습위주", "#전문적", "#추천"],
      likes: 214,
      body: "수치와 감각을 연결해 설명해주셔서 좋았습니다. 로깅 기준을 새로 잡는 데 도움이 됐습니다.",
    },
    {
      id: "hand-drip-meetup",
      eventId: "hand-drip-workshop",
      title: "Hand Drip is harder than it looks!",
      category: "meetup",
      author: {
        name: "hand_drip_fan",
        handle: "hand_drip_fan",
      },
      createdAt: "2026-05-03T11:00:00+09:00",
      imageUrls: [coffeeImages.dripper],
      keywords: ["#Brewing", "#Weekend"],
      likes: 112,
      body: "서로 다른 레시피를 비교해볼 수 있어 좋았습니다. 같은 원두라도 추출 방식에 따라 컵이 크게 달라졌습니다.",
    },
    {
      id: "espresso-science",
      eventId: "espresso-extraction-101",
      title: "에스프레소 추출의 과학",
      category: "seminar",
      author: {
        name: "espresso_geek",
        handle: "espresso_geek",
      },
      createdAt: "2026-04-27T12:00:00+09:00",
      imageUrls: [coffeeImages.espresso],
      keywords: ["#심도깊음", "#학습효과"],
      likes: 145,
      body: "추출압과 분쇄도 관계를 실제 머신으로 확인할 수 있어 유익했습니다.",
    },
    ...extraCommunityReviews,
  ],
  recipes: [
    {
      id: "ethiopia-v60",
      title: "산뜻한 베리 향의 에티오피아 드립",
      roast: "light",
      author: {
        name: "CoffeeMaster",
        handle: "barista_kim",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      },
      likes: 1200,
      liked: false,
      viewCount: 2400,
      coverUrl: coffeeImages.signature,
      processImages: [
        coffeeImages.flower,
        coffeeImages.dripper,
        coffeeImages.brew,
      ],
      bean: {
        origin: "에티오피아 (Ethiopia)",
        process: "내추럴 (Natural)",
        roastPoint: "라이트 (Light)",
      },
      extraction: {
        dosing: "20g",
        yield: "300ml",
        time: "2' 30\"",
        temp: "92°C",
      },
      note: "산뜻한 산미를 극대화하기 위해 고대역 필터를 사용하고 92도 물을 준비했습니다. 낮은 온도의 물을 추천합니다. 첫 모금에서 느껴지는 베리의 향연을 즐겨보세요.",
    },
    {
      id: "guatemala-antigua",
      title: "Guatemala Antigua Blend",
      roast: "medium",
      author: { name: "roaster_lee", handle: "roaster_lee" },
      likes: 98,
      liked: false,
      viewCount: 320,
      coverUrl: coffeeImages.beans,
      processImages: [coffeeImages.beans],
      bean: { origin: "과테말라", process: "워시드", roastPoint: "미디엄" },
      extraction: { dosing: "18g", yield: "36g", time: "28s", temp: "93°C" },
      note: "초콜릿과 견과류 톤을 안정적으로 끌어내는 에스프레소 베이스입니다.",
    },
    {
      id: "silky-flat-white",
      title: "Silky Flat White Base",
      roast: "medium",
      author: { name: "latte_master", handle: "latte_master" },
      likes: 89,
      liked: false,
      viewCount: 284,
      coverUrl: coffeeImages.latte,
      processImages: [coffeeImages.latte],
      bean: {
        origin: "브라질",
        process: "펄프드 내추럴",
        roastPoint: "미디엄",
      },
      extraction: { dosing: "19g", yield: "38g", time: "30s", temp: "92°C" },
      note: "우유와 섞였을 때 질감이 부드럽게 남도록 설계했습니다.",
    },
    {
      id: "summer-flash-brew",
      title: "Summer Flash Brew",
      roast: "light",
      author: { name: "coldbrew_collective", handle: "coldbrew_collective" },
      likes: 42,
      liked: false,
      viewCount: 190,
      coverUrl: coffeeImages.brew,
      processImages: [coffeeImages.brew],
      bean: { origin: "케냐", process: "워시드", roastPoint: "라이트" },
      extraction: {
        dosing: "22g",
        yield: "220ml",
        time: "2' 10\"",
        temp: "94°C",
      },
      note: "얼음 위로 바로 추출해 향미 손실을 줄이는 여름용 레시피입니다.",
    },
    ...Array.from({ length: 6 }).map((_, index) => ({
      id: `recipe-placeholder-${index + 1}`,
      title:
        [
          "Classic Cappuccino",
          "Aeropress Inverted Method",
          "Mocha Variations",
          "Cold Brew Concentrate",
          "Nitro Cold Brew Base",
          "French Press Basics",
        ][index] ?? "Coffee Recipe",
      roast: roastCycle[index % roastCycle.length],
      author: { name: `brew_${index + 1}`, handle: `brew_${index + 1}` },
      likes: [15, 33, 76, 12, 8, 55][index] ?? 10,
      liked: false,
      viewCount: 80 + index * 12,
      coverUrl: undefined,
      processImages: [],
      bean: { origin: "미정", process: "미정", roastPoint: "미정" },
      extraction: { dosing: "-", yield: "-", time: "-", temp: "-" },
      note: "곧 상세 레시피가 업데이트됩니다.",
    })),
  ],
  qaPosts: [
    {
      id: "espresso-channeling",
      title: "에스프레소 채널링 현상이 계속 발생합니다. 도와주세요.",
      authorName: "익명",
      createdAgo: "2시간 전",
      createdAt: "2026-05-12T09:00:00+09:00",
      commentCount: 5,
      imageUrl: coffeeImages.qna,
      imageUrls: [coffeeImages.qna],
      body: "최근 바텀리스 포터필터를 사용하기 시작했는데, 추출할 때마다 사방으로 튀는 채널링 현상이 너무 심합니다. 원두는 약배전이고 분쇄도는 평소보다 약간 가늘게 세팅했습니다. 도징량은 18g, 추출량은 36g 목표로 하고 있습니다. 경험 많으신 분들의 조언 부탁드립니다.",
      likes: 12,
      liked: false,
      viewCount: 430,
      comments: [
        {
          id: "c1",
          authorName: "익명 1",
          createdAgo: "1시간 전",
          body: "약배전 원두는 밀도가 높아서 추출 저항이 강합니다. 분쇄도를 조금 더 굵고 도징량을 19g 정도로 늘려보시는 건 어떨까요?",
          likes: 3,
          replies: [
            {
              id: "c1-r1",
              authorName: "익명",
              createdAgo: "45분 전",
              body: "분쇄도를 굵게 할수록 시간이 너무 짧아지지 않을까요? 현재 18g으로 25초 정도 걸리는데, 19g으로 늘리면 시간이 어떻게 변할지 궁금합니다.",
              likes: 1,
              isOwner: true,
            },
          ],
        },
        {
          id: "c2",
          authorName: "익명 2",
          createdAgo: "10분 전",
          body: "디스트리뷰터가 오히려 표면만 평평하게 하고 내부 밀도는 다르게 만들어서 채널링 원인이 되기도 합니다. WDT 툴만 사용해서 가볍게 탬핑해보세요.",
          likes: 2,
        },
      ],
    },
    ...Array.from({ length: 56 }).map((_, index) => ({
      id: `qa-${index + 2}`,
      title: [
        "우유 스티밍할 때 거품이 자꾸 분리되는 현상 해결 방법",
        "로스팅 포인트에 따른 분쇄도 조절 가이드가 있을까요?",
        "말코닉 ek43 영점 조절 주기 보통 어떻게 하시나요?",
        "플랫화이트와 라떼의 폼 두께 차이, 어느 정도가 적당한가요",
        "디카페인 원두 추출 시 크레마가 얇게 나오는 게 정상인가요?",
        "핸드드립 하리오 v60 사용 시 물빠짐이 너무 빠릅니다.",
        "여름철 원두 보관, 냉동보관이 진짜 답일까요? 실온보관과 비교",
        "바텀리스 포터필터 채널링 잡는 팁 공유해주세요 ㅠㅠ",
        "매장 음악 플레이리스트 추천받습니다. 재즈 말고 모던한 걸로요.",
        "그라인더 청소 주기와 분해 청소 범위가 궁금합니다.",
      ][index % 10],
      authorName: "익명",
      createdAgo:
        [
          "4시간 전",
          "6시간 전",
          "12시간 전",
          "어제",
          "어제",
          "2026.05.21",
          "2026.05.20",
          "2026.05.20",
          "2026.05.19",
        ][index % 9] ?? "어제",
      createdAt: "2026-05-10T09:00:00+09:00",
      commentCount: [8, 15, 3, 21, 6, 11, 34, 19, 42][index % 9] ?? 0,
      body: "질문 본문이 곧 업데이트됩니다.",
      likes: 0,
      liked: false,
      viewCount: 30 + index * 7,
      comments: [],
    })),
  ],
};
