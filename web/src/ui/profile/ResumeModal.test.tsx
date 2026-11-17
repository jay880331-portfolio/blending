import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CareerItem,
  MemberProfile,
  PortfolioItem,
} from "@/domain/member/types";
import { ResumeDocument } from "./ResumeModal";

const profile: MemberProfile = {
  id: "profile-1",
  name: "김성철",
  handle: "ksc",
  role: "barista",
  avatarUrl: "/avatar.jpg",
  online: true,
  status: "focused",
  workplace: "소속명",
  workplaces: ["소속명"],
  specialties: ["에스프레소", "라떼아트"],
  bio: "나는야 블렌딩, 에스프레소 전문가",
  favoriteCount: 0,
  isPortfolioPublic: true,
  certificateName: "",
  officialBadges: [],
  isOwnProfile: true,
  socials: {
    instagram: "@ksc_barista",
    threads: "",
    website: "",
    recipeUrl: "",
  },
  baristaProfile: {
    contactPhone: "010-1234-5678",
    employmentTypes: [],
    totalExperience: "",
    certificateFileUrls: [],
    espressoMachineBrands: ["라마르조꼬 (La Marzocco)"],
    espressoMachineBrandOther: "",
    grinderBrands: ["말코닉 (Mahlkonig)"],
    grinderBrandOther: "",
    roasterBrands: [],
    roasterBrandOther: "",
    preferredBeans: "에티오피아 (Ethiopia)",
    preferredBeanNotes: ["산미 (Acidity)"],
  },
  workplaceLocations: [
    {
      id: "loc-1",
      name: "Seoul",
      address: "Seoul, Republic of Korea",
      lat: 37.5665,
      lng: 126.978,
      displayName: "Seoul, Republic of Korea",
    },
  ],
};

const mockupCareers: CareerItem[] = [
  {
    id: "career-1",
    type: "career",
    year: "2024",
    period: "2024 ~ 2026",
    title: "직책",
    organization: "소속명",
    detail:
      "에스프레소 일일 다이얼인 세팅 및 일관된 추출 수율 관리 (WBC 가이드라인 도입)\n하이엔드 상업용 장비(라마르조꼬 PB, EK43S) 예방 정비 및 바 설계 최적화\n매장 매출 및 원두 품질 균일도 확보, 주니어 바리스타 교육 전담",
  },
  {
    id: "career-2",
    type: "career",
    year: "2023",
    period: "2023",
    title: "직책",
    organization: "소속명",
    detail: "직무 설명\n직무 설명",
  },
  {
    id: "award-1",
    type: "award",
    year: "2023",
    period: "",
    title: "THE SPECIALTY COFFEE ASSOCIATION(SCA)",
  },
  {
    id: "award-2",
    type: "award",
    year: "2022",
    period: "",
    title: "코리아 커피 리그(KCL) 라떼아트 부문 Finalist",
  },
  {
    id: "award-3",
    type: "award",
    year: "2021",
    period: "",
    title: "브루잉 마스터 클래스 수료 (SCA Intermediate)",
  },
];

const mockupPortfolios: PortfolioItem[] = [
  {
    id: "p1",
    title: "Rosetta Latte Art",
    createdAt: "2024-01-01",
    summary: "정교한 패턴과 균형감으로 완성도 높은 라떼아트 구현",
    imageUrls: ["/latte.jpg"],
  },
  {
    id: "p2",
    title: "Espresso Extraction",
    createdAt: "2024-01-02",
    summary: "정확한 추출 파라미터로 일관된 수율과 풍미 유지",
    imageUrls: ["/espresso.jpg"],
  },
  {
    id: "p3",
    title: "Signature Menu",
    createdAt: "2024-01-03",
    summary: "계절감과 스토리를 담은 시그니처 메뉴 개발",
    imageUrls: ["/menu.jpg"],
  },
];

function renderEmpty() {
  return renderToStaticMarkup(
    <ResumeDocument
      profile={profile}
      careers={[]}
      portfolios={[]}
      onClose={() => undefined}
    />,
  );
}

it("renders the html2 resume shell with dark accent and new heading classes", () => {
  const html = renderEmpty();

  assert.match(html, /--accent:#0b0f1a/);
  assert.match(html, /rsm-card/);
  assert.match(html, /rsm-side-h3/);
  assert.match(html, /rsm-sec-h2/);
  assert.match(html, /background:#eef1ec/);
  assert.match(html, /width:1060px;max-width:100%/);
  assert.match(html, /background:#f7f8fa/);
  assert.match(html, /padding:32px 56px 24px/);
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\)/);
  assert.match(html, /background:#f4f6f1/);
  assert.match(html, /padding:48px 36px/);
  assert.match(html, /font-size:44px/);
  assert.match(html, /BodoniModa-Latin\.woff2/);
  assert.match(
    html,
    /linear-gradient\(90deg, var\(--accent\), transparent 70%\)/,
  );
  assert.match(html, /linear-gradient\(135deg, var\(--accent\), #0b0f1a33\)/);
  assert.match(html, /1px solid var\(--accent\)/);
  assert.match(html, /background:var\(--accent\)/);
  assert.match(html, /라마르조꼬 \(La Marzocco\)/);
  assert.match(html, /산미 \(Acidity\)/);
  assert.match(html, /::selection \{ background: #c3f53c; color: #0b0f1a; \}/);
  assert.match(html, /aria-label="프로필 QR 코드" width="56" height="56"/);
  assert.match(html, /width="138" height="138"/);
  assert.match(html, /&quot;나는야 블렌딩, 에스프레소 전문가&quot;/);
  assert.match(html, /CERTIFIED BY BLENDING PLATFORM/);
  assert.doesNotMatch(html, /--accent:#c3f53c/);
});

it("hides portfolio, career, and awards", () => {
  const html = renderEmpty();

  assert.doesNotMatch(html, /PORTFOLIO/);
  assert.doesNotMatch(html, /등록된 포트폴리오가 없습니다/);
  assert.doesNotMatch(html, /WORK EXPERIENCE/);
  assert.doesNotMatch(html, /AWARDS &amp; CERTIFICATIONS/);
  assert.doesNotMatch(html, /등록된 경력이 없습니다/);
  assert.doesNotMatch(html, /등록된 수상·자격이 없습니다/);
  assert.doesNotMatch(html, /등록된 이력 정보가 없습니다/);
});

it("includes html2 fluid, safe-area, and heading CSS that previous code missed", () => {
  const html = renderEmpty();

  assert.match(html, /@media \(max-width: 900px\)/);
  assert.match(html, /@media \(max-width: 520px\)/);
  assert.match(html, /@media \(max-width: 640px\)/);
  assert.match(
    html,
    /\.rsm-header \{\s*padding-top: calc\(clamp\(20px, 3\.4vw, 32px\) \+ env\(safe-area-inset-top, 0px\)\) !important;/,
  );
  assert.match(
    html,
    /padding-top: calc\(20px \+ max\(44px, env\(safe-area-inset-top, 0px\)\)\) !important;/,
  );
  assert.match(
    html,
    /padding-right: calc\(78px \+ env\(safe-area-inset-right, 0px\)\) !important;/,
  );
  assert.match(
    html,
    /padding-bottom: calc\(28px \+ env\(safe-area-inset-bottom, 0px\)\) !important;/,
  );
  assert.match(
    html,
    /\.rsm-sec-h2, \.rsm-side-h3 \{ overflow-wrap: normal !important; word-break: keep-all !important; \}/,
  );
  assert.match(
    html,
    /\.rsm-sec-h2 \{ align-items: flex-start !important; line-height: 1\.35; \}/,
  );
  assert.match(
    html,
    /\.rsm-sec-h2 > span:first-child \{ margin-top: 0\.5em; flex: none; \}/,
  );
  assert.match(
    html,
    /\.rsm-sec-h2 \{ font-size: 13px !important; letter-spacing: 0\.22em !important; gap: 10px !important; \}/,
  );
  assert.match(
    html,
    /\.rsm-side-h3 \{ font-size: 12px !important; letter-spacing: 0\.2em !important; \}/,
  );
  assert.match(html, /clamp\(0px, 3vw, 56px\)/);
  assert.match(html, /\.rsm-outer canvas \{ display: block; \}/);
});

it("keeps the mobile close button below the iPhone safe area", () => {
  const html = renderEmpty();

  assert.match(
    html,
    /\.rsm-close \{ top: calc\(env\(safe-area-inset-top\) \+ 8px\); right: 8px; \}/,
  );
});

it("renders contact without portfolio, phone, career, or awards", () => {
  const html = renderToStaticMarkup(
    <ResumeDocument
      profile={profile}
      account={{
        country: "KR",
        identityVerified: true,
        email: "ksc.barista@blending.com",
        phone: "010-1234-5678",
      }}
      careers={mockupCareers}
      portfolios={mockupPortfolios}
      onClose={() => undefined}
    />,
  );

  assert.doesNotMatch(html, /PORTFOLIO/);
  assert.doesNotMatch(html, /Rosetta Latte Art/);
  assert.doesNotMatch(html, /Espresso Extraction/);
  assert.doesNotMatch(html, /Signature Menu/);
  assert.match(html, /ksc\.barista@blending\.com/);
  assert.match(html, /@ksc_barista/);
  assert.match(html, /Seoul, Republic of Korea/);
  assert.doesNotMatch(html, /WORK EXPERIENCE/);
  assert.doesNotMatch(html, /AWARDS &amp; CERTIFICATIONS/);
  assert.doesNotMatch(html, /2024 ~ 2026/);
  assert.doesNotMatch(html, /010-1234-5678/);
  assert.doesNotMatch(html, /등록된 포트폴리오가 없습니다/);
});
