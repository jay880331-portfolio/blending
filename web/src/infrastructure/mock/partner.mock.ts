import type { PartnerSnapshot } from "@/domain/partner/types";

const partnerImages = {
  machine:
    "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=900&q=80",
  machineFront:
    "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=80",
  grinder:
    "https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?auto=format&fit=crop&w=900&q=80",
  espresso:
    "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=900&q=80",
  roaster:
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80",
  brew: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  cafe: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=900&q=80",
  barista:
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80",
  pitcher:
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
  brochure:
    "https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=900&q=80",
  ice: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
  cups: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80",
};

const extraPromotionCategories = [
  "espresso-machine",
  "grinder",
  "ice-equipment",
  "brewing-roaster",
  "supplies",
  "ingredient",
] as const;

const extraPromotionImages = [
  partnerImages.machineFront,
  partnerImages.grinder,
  partnerImages.espresso,
  partnerImages.roaster,
  partnerImages.ice,
  partnerImages.brew,
  partnerImages.pitcher,
] as const;

const extraPartnerPromotions: PartnerSnapshot["promotions"] = Array.from(
  { length: 35 },
  (_, index) => {
    const category =
      extraPromotionCategories[index % extraPromotionCategories.length];
    const image = extraPromotionImages[index % extraPromotionImages.length];
    const date = new Date(
      `2026-05-${String(6 - Math.floor(index / 7)).padStart(2, "0")}T${String(18 - (index % 7)).padStart(2, "0")}:00:00+09:00`,
    );

    return {
      id: `partner-promotion-${String(index + 1).padStart(2, "0")}`,
      title: [
        "카페 자동 탬핑 스테이션",
        "스페셜티 원두 샘플러",
        "브루잉 서버 패키지",
        "매장 전용 청소 키트",
        "콜드브루 추출 탱크",
        "바리스타 앞치마 세트",
        "디저트 쇼케이스 소형",
      ][index % 7],
      category,
      companyName: [
        "브루랩",
        "스테이션커피",
        "로스팅파트너스",
        "쿨라인",
        "빈마켓",
      ][index % 5],
      authorName: ["파트너팀", "장비매니저", "운영지원", "납품상담"][index % 4],
      createdAt: date.toISOString(),
      summary:
        "매장 운영자가 빠르게 비교할 수 있도록 구성한 파트너 홍보 목업 데이터입니다.",
      description:
        "커피 매장 운영 동선과 반복 업무를 기준으로 장비, 소모품, 부재료 정보를 정리했습니다. 실제 등록 플로우와 페이지네이션 확인을 위한 목업 항목입니다.",
      thumbnailUrl: image,
      imageUrls: [image, partnerImages.cafe, partnerImages.brew],
      brochureUrls: [partnerImages.brochure],
      tags: ["#카페장비", "#파트너홍보", "#운영효율"],
      externalUrl: "https://example.com/products/mock-partner-promotion",
      likes: 24 + index * 3,
      liked: false,
      viewCount: 140 + index * 11,
      specs: {
        companyName: [
          "브루랩",
          "스테이션커피",
          "로스팅파트너스",
          "쿨라인",
          "빈마켓",
        ][index % 5],
        productName: `파트너 홍보 상품 ${index + 1}`,
        categoryLabel: "파트너 홍보",
      },
    };
  },
);

const extraPartnerReviews: PartnerSnapshot["reviews"] = Array.from(
  { length: 18 },
  (_, index) => {
    const category =
      extraPromotionCategories[index % extraPromotionCategories.length];
    const image = extraPromotionImages[index % extraPromotionImages.length];
    const day = 9 - Math.floor(index / 3);
    const date = new Date(
      `2026-05-${String(day).padStart(2, "0")}T${String(17 - (index % 3)).padStart(2, "0")}:30:00+09:00`,
    );

    return {
      id: `partner-review-${String(index + 1).padStart(2, "0")}`,
      promotionId: [
        "linea-mini",
        "ek43-black",
        "rocket-r58",
        "air-roaster-pro",
        "compact-ice",
        "filter-paper-kit",
      ][index % 6],
      productName: [
        "바텀리스 포터필터 세트",
        "싱글 도징 그라인더",
        "카페용 제빙기 테스트",
        "브루잉 서버 키트",
        "콜드브루 탱크",
        "시그니처 베이스 샘플",
      ][index % 6],
      category,
      brand: ["BLENDING", "Mahlkonig", "Rocket", "Roasting Works"][index % 4],
      modelName: `Mock Review ${index + 1}`,
      features: "매장 적용성, 반복 사용 안정성",
      createdAt: date.toISOString(),
      reviewer: {
        name: ["바리스타L", "커핑랩", "로스터A", "운영매니저"][index % 4],
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
        resumeUrl: "/home",
      },
      summary:
        "파트너 장비를 실제 매장 동선 기준으로 사용해 본 뒤 장단점을 정리한 목업 리뷰입니다.",
      body: "반복 사용 시 세팅 유지가 쉬운지, 청소 동선이 부담스럽지 않은지, 직원 교육에 얼마나 빨리 녹아드는지를 중심으로 확인했습니다. 페이지네이션 확인을 위한 목업 리뷰입니다.",
      imageUrls: [image, partnerImages.cafe],
      tags: ["#장비리뷰", "#매장운영", "#파트너"],
      majorPros: ["반복 사용이 쉬움", "관리 동선이 단순함", "교육 적용이 빠름"],
      baristaTip:
        "처음 도입할 때는 피크 타임 전후로 테스트 시간을 나누면 실제 운영 편차를 더 잘 볼 수 있습니다.",
      relatedUrl: "/partner/promotions/linea-mini",
      likes: 18 + index * 2,
      liked: false,
      viewCount: 95 + index * 9,
    };
  },
);

export const partnerMock: PartnerSnapshot = {
  banners: [
    {
      id: "premium-machine-week",
      title: "하이엔드 머신 기획전",
      subtitle: "완벽한 한 잔을 위한 최고의 선택",
      imageUrl: partnerImages.machine,
      href: "https://example.com/premium-machine-week",
      sortOrder: 0,
      activeFrom: "2020-01-01T00:00:00.000Z",
      activeTo: "2100-01-01T00:00:00.000Z",
    },
    {
      id: "grinder-calibration",
      title: "그라인더 캘리브레이션",
      subtitle: "균일한 분쇄도를 위한 파트너 제안",
      imageUrl: partnerImages.grinder,
      href: "https://example.com/grinder-calibration",
      sortOrder: 1,
      activeFrom: "2020-01-01T00:00:00.000Z",
      activeTo: "2100-01-01T00:00:00.000Z",
    },
  ],
  promotions: [
    {
      id: "linea-mini",
      title: "라마르조꼬 리네아 미니",
      category: "espresso-machine",
      companyName: "BLENDING",
      authorName: "커피매니아",
      createdAt: "2026-05-12T09:20:00+09:00",
      summary:
        "카페에서 즐기던 완벽한 에스프레소를 집에서도 경험하게 하는 컴팩트 상업용 머신입니다.",
      description:
        "상업용 에스프레소 머신의 대명사 라마르조꼬 기술을 그대로 담은 모델입니다. 독립형 듀얼 보일러 시스템을 채택해 에스프레소 추출과 스티밍을 동시에 안정적으로 수행할 수 있습니다. 작은 바 테이블과 쇼룸, 교육 공간에서도 전문 카페 수준의 일관된 커피 맛을 보장합니다.",
      thumbnailUrl: partnerImages.machineFront,
      imageUrls: [
        partnerImages.machineFront,
        partnerImages.machine,
        partnerImages.espresso,
        partnerImages.cafe,
        partnerImages.brew,
        partnerImages.pitcher,
      ],
      brochureUrls: [partnerImages.brochure, partnerImages.cafe],
      tags: ["#하이엔드", "#바리스타추천", "#홈카페", "#듀얼보일러"],
      externalUrl: "https://example.com/products/linea-mini",
      likes: 182,
      liked: false,
      viewCount: 960,
      specs: {
        companyName: "BLENDING",
        productName: "라마르조꼬 리네아 미니",
        categoryLabel: "에스프레소 머신",
      },
    },
    {
      id: "ek43-black",
      title: "말코닉 EK43 블랙",
      category: "grinder",
      companyName: "커피기구상사",
      authorName: "바리스타K",
      createdAt: "2026-05-12T06:05:00+09:00",
      summary:
        "정밀한 분쇄도 조절이 가능한 하이엔드 그라인더. 균일한 입자 분포로 브루잉 품질을 끌어올립니다.",
      description:
        "커핑, 필터 브루잉, 에스프레소 세팅까지 폭넓은 분쇄 범위를 제공하는 플래그십 그라인더입니다. 대형 버와 안정적인 모터가 반복 사용에도 균일한 입자 분포를 유지합니다.",
      thumbnailUrl: partnerImages.grinder,
      imageUrls: [
        partnerImages.grinder,
        partnerImages.roaster,
        partnerImages.brew,
        partnerImages.espresso,
      ],
      brochureUrls: [partnerImages.brochure],
      tags: ["#그라인더", "#분쇄도", "#커핑"],
      externalUrl: "https://example.com/products/ek43",
      likes: 97,
      liked: true,
      viewCount: 710,
      specs: {
        companyName: "커피기구상사",
        productName: "말코닉 EK43 블랙",
        categoryLabel: "그라인더",
      },
    },
    {
      id: "rocket-r58",
      title: "로켓 R58 씬크로",
      category: "espresso-machine",
      companyName: "로티스커피랩",
      authorName: "에센셜브루",
      createdAt: "2026-05-11T11:30:00+09:00",
      summary:
        "PID 온도 제어 기술로 정교한 브루잉 프로파일을 완성하는 듀얼 보일러 머신입니다.",
      description:
        "프리미엄 스테인리스 바디와 안정적인 추출 압력을 갖춘 머신입니다. 매장 규모가 크지 않아도 전문적인 추출 환경을 만들고 싶은 파트너에게 적합합니다.",
      thumbnailUrl: partnerImages.espresso,
      imageUrls: [
        partnerImages.espresso,
        partnerImages.machine,
        partnerImages.pitcher,
      ],
      brochureUrls: [partnerImages.brochure],
      tags: ["#PID", "#듀얼보일러", "#카페장비"],
      externalUrl: "https://example.com/products/r58",
      likes: 74,
      liked: false,
      viewCount: 540,
      specs: {
        companyName: "로티스커피랩",
        productName: "로켓 R58 씬크로",
        categoryLabel: "에스프레소 머신",
      },
    },
    {
      id: "air-roaster-pro",
      title: "에어 로스터 프로 7kg",
      category: "brewing-roaster",
      companyName: "로스팅웍스",
      authorName: "로스터리팀",
      createdAt: "2026-05-10T15:45:00+09:00",
      summary: "소형 로스터리와 교육장을 위한 안정적인 열풍식 로스터기입니다.",
      description:
        "반복 로스팅 품질을 관리하기 쉬운 열풍식 구조와 직관적인 프로파일 저장 기능을 제공합니다. 샘플 로스팅에서 소량 생산까지 자연스럽게 확장됩니다.",
      thumbnailUrl: partnerImages.roaster,
      imageUrls: [
        partnerImages.roaster,
        partnerImages.cafe,
        partnerImages.grinder,
      ],
      brochureUrls: [partnerImages.brochure],
      tags: ["#로스터기", "#열풍식", "#교육장비"],
      externalUrl: "https://example.com/products/air-roaster",
      likes: 52,
      liked: false,
      viewCount: 380,
      specs: {
        companyName: "로스팅웍스",
        productName: "에어 로스터 프로 7kg",
        categoryLabel: "브루잉·로스터기",
      },
    },
    {
      id: "compact-ice",
      title: "컴팩트 제빙 설비 C20",
      category: "ice-equipment",
      companyName: "쿨라인",
      authorName: "설비매니저",
      createdAt: "2026-05-09T09:10:00+09:00",
      summary: "좁은 바 공간에도 배치하기 쉬운 카페 전용 제빙 솔루션입니다.",
      description:
        "세척 동선과 드레인 연결을 고려한 설계로 오픈바에 적합합니다. 과열 방지와 에너지 절감 모드를 지원합니다.",
      thumbnailUrl: partnerImages.ice,
      imageUrls: [partnerImages.ice, partnerImages.cafe],
      brochureUrls: [],
      tags: ["#제빙기", "#설비", "#카페오픈"],
      externalUrl: "https://example.com/products/c20",
      likes: 31,
      liked: false,
      viewCount: 240,
      specs: {
        companyName: "쿨라인",
        productName: "컴팩트 제빙 설비 C20",
        categoryLabel: "제빙기·설비",
      },
    },
    {
      id: "filter-paper-kit",
      title: "브루잉 필터 페이퍼 키트",
      category: "supplies",
      companyName: "브루키트",
      authorName: "납품팀",
      createdAt: "2026-05-08T13:00:00+09:00",
      summary:
        "핸드드립 바 운영에 필요한 필터와 소모품을 한 번에 구성한 공급 키트입니다.",
      description:
        "매장별 월 사용량에 맞춰 구독형 납품이 가능한 필터 페이퍼 세트입니다. 향미 간섭이 적은 재질로 다양한 추출 방식에 대응합니다.",
      thumbnailUrl: partnerImages.brew,
      imageUrls: [partnerImages.brew, partnerImages.cups],
      brochureUrls: [],
      tags: ["#소모품", "#브루잉", "#납품"],
      externalUrl: "https://example.com/products/filter-kit",
      likes: 45,
      liked: false,
      viewCount: 290,
      specs: {
        companyName: "브루키트",
        productName: "브루잉 필터 페이퍼 키트",
        categoryLabel: "용품·소모품",
      },
    },
    {
      id: "signature-syrup",
      title: "시그니처 바닐라 베이스",
      category: "ingredient",
      companyName: "스윗라인",
      authorName: "메뉴개발팀",
      createdAt: "2026-05-07T17:20:00+09:00",
      summary: "라떼와 콜드브루 메뉴에 어울리는 카페 전용 부재료 베이스입니다.",
      description:
        "과한 단맛을 줄이고 우유와 커피 향을 자연스럽게 살리는 레시피입니다. 시그니처 음료 개발용 샘플 키트를 제공합니다.",
      thumbnailUrl: partnerImages.pitcher,
      imageUrls: [partnerImages.pitcher, partnerImages.espresso],
      brochureUrls: [],
      tags: ["#부재료", "#메뉴개발", "#샘플키트"],
      externalUrl: "https://example.com/products/vanilla-base",
      likes: 63,
      liked: false,
      viewCount: 410,
      specs: {
        companyName: "스윗라인",
        productName: "시그니처 바닐라 베이스",
        categoryLabel: "부재료",
      },
    },
    ...extraPartnerPromotions,
  ],
  reviews: [
    {
      id: "linea-mini-review",
      promotionId: "linea-mini",
      productName: "라마르조꼬 리네아 미니",
      category: "espresso-machine",
      brand: "La Marzocco",
      modelName: "Linea Mini",
      features: "듀얼 보일러, 안정적인 스팀 압력",
      createdAt: "2026-05-12T08:15:00+09:00",
      reviewer: {
        name: "바리스타J",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
        resumeUrl: "/profile/barista-j",
      },
      summary:
        "한 달 동안 사용해 보니 출근 직후부터 마감까지 추출 압력이 안정적으로 유지됐습니다.",
      body: "이 머신을 한 달간 사용해 본 결과 홈 카페 기준을 한 단계 끌어올리는 경험이었습니다. 상업용 머신의 성능을 콤팩트한 사이즈에 담았다는 기술력이 돋보입니다.\n\n특히 온도 유지력이 탁월하여 연속 추출 시에도 맛의 편차가 거의 없습니다. 듀얼 보일러 시스템 덕분에 스팀 작업과 에스프레소 추출을 동시에 안정적으로 수행할 수 있었습니다.\n\n가격대가 높은 편이지만 커피에 진심인 분들이라면 충분히 투자 가치가 있는 장비입니다.",
      imageUrls: [
        partnerImages.machine,
        partnerImages.espresso,
        partnerImages.pitcher,
      ],
      tags: ["#에스프레소머신", "#하이엔드", "#홈카페", "#라마르조꼬"],
      majorPros: [
        "상업용 수준의 안정적인 온도 유지",
        "강력하고 일정한 스팀 압력",
        "견고한 내구성과 클래식 디자인",
      ],
      baristaTip:
        "추출 전 2분 정도 공회전으로 그룹헤드를 충분히 예열하면 첫 잔에서도 안정적인 결과가 나옵니다.",
      relatedUrl: "/partner/promotions/linea-mini",
      likes: 42,
      liked: false,
      viewCount: 300,
    },
    {
      id: "ek43-review",
      promotionId: "ek43-black",
      productName: "말코닉 EK43",
      category: "grinder",
      brand: "Mahlkonig",
      modelName: "EK43",
      features: "균일한 분쇄, 넓은 분쇄 범위",
      createdAt: "2026-05-11T18:30:00+09:00",
      reviewer: {
        name: "커핑랩",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80",
        resumeUrl: "/profile/cupping-lab",
      },
      summary:
        "커핑과 필터 브루잉 사이를 오가는 매장에서 세팅 변경이 빠르고 반복성이 좋았습니다.",
      body: "분쇄도 조절 범위가 넓어서 커핑 테이블과 브루잉 바를 함께 운영하는 매장에 잘 맞습니다. 입자 분포가 안정적이라 추출 데이터가 흔들릴 때 원인을 좁히기 쉽습니다.",
      imageUrls: [partnerImages.grinder, partnerImages.roaster],
      tags: ["#그라인더", "#커핑", "#분쇄도"],
      majorPros: [
        "균일한 입자 분포",
        "분쇄도 전환이 빠름",
        "청소 동선이 단순함",
      ],
      baristaTip:
        "필터 브루잉용 세팅은 전날 마감 전에 맞춰두면 오픈 직후 추출 편차를 줄일 수 있습니다.",
      relatedUrl: "/partner/promotions/ek43-black",
      likes: 28,
      liked: false,
      viewCount: 220,
    },
    {
      id: "r58-review",
      promotionId: "rocket-r58",
      productName: "로켓 R58 씬크로",
      category: "espresso-machine",
      brand: "Rocket",
      modelName: "R58",
      features: "PID 제어, 듀얼 보일러",
      createdAt: "2026-05-10T16:00:00+09:00",
      reviewer: {
        name: "에센셜브루",
        avatarUrl:
          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80",
        resumeUrl: "/profile/essential-brew",
      },
      summary:
        "작은 매장에서도 예열 루틴만 안정화하면 일관적인 추출을 만들 수 있었습니다.",
      body: "바디는 탄탄하고 추출 조작감이 직관적입니다. PID 설정을 잘 잡아두면 계절 변화에도 추출 레시피를 크게 흔들지 않고 유지할 수 있었습니다.",
      imageUrls: [partnerImages.espresso, partnerImages.cafe],
      tags: ["#PID", "#듀얼보일러", "#카페장비"],
      majorPros: [
        "온도 제어가 직관적",
        "스팀 압력이 충분함",
        "유지보수 접근성이 좋음",
      ],
      baristaTip:
        "오픈 직후 첫 샷은 버리고 두 번째 샷부터 서비스하면 컵 편차가 줄어듭니다.",
      relatedUrl: "/partner/promotions/rocket-r58",
      likes: 31,
      liked: false,
      viewCount: 260,
    },
    ...extraPartnerReviews,
  ],
};
