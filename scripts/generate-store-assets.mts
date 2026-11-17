import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "web/package.json"));
const sharp = require("sharp");
const sourceRaw = resolve(root, "docs/store-assets/archive/v1/raw");
const raw = resolve(root, "docs/store-assets/raw");
const output = resolve(root, "docs/store-assets/final");

const layouts = {
  android: { width: 1080, height: 1920, screenWidth: 880, screenY: 340 },
  iphone: { width: 1320, height: 2868, screenWidth: 1180, screenY: 510 },
  ipad: { width: 2064, height: 2752, screenWidth: 1880, screenY: 640 },
};

const screens = [
  ["home", "경력과 작업을\n한 장의 프로필로"],
  ["map", "가까운 커피인을\n지도에서 발견하세요"],
  ["calendar", "놓치기 쉬운 일정을\n한눈에 모아보세요"],
  ["partner-reviews", "현장의 경험으로\n장비를 고르세요"],
  ["mypage", "기록부터 연결까지\n내 활동을 한곳에"],
];

const reviewPhotoUrls = [
  "https://images.unsplash.com/photo-1771333105706-5598d83224a3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1763705857770-196117f08703?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1565845120211-ec64763a0dea?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1553329701-1abe5e1bf403?auto=format&fit=crop&w=1200&q=80",
];

const treatments = [
  { background: "#F3F4F6", scale: 0.9, shift: 0.06, y: 0.05 },
  { background: "#FAFAFA", scale: 1.06, shift: -0.035, y: 0 },
  { background: "#F3F4F6", scale: 0.94, shift: 0.055, y: 0.04 },
  { background: "#FAFAFA", scale: 1.02, shift: -0.025, y: 0.015 },
  { background: "#F3F4F6", scale: 0.95, shift: 0.05, y: 0.035 },
] as const;

const [displayFont, boldFont, bodyFont, pixelFont] = await Promise.all([
  readFile(resolve(root, "web/public/fonts/SeoulNamsanEB.ttf")),
  readFile(resolve(root, "web/public/fonts/SeoulNamsanB.ttf")),
  readFile(resolve(root, "web/public/fonts/SeoulNamsanM.ttf")),
  readFile(resolve(root, "web/public/fonts/Galmuri11.ttf")),
]);
const fontCss = `@font-face{font-family:Display;src:url(data:font/ttf;base64,${displayFont.toString("base64")})}@font-face{font-family:Bold;src:url(data:font/ttf;base64,${boldFont.toString("base64")})}@font-face{font-family:Body;src:url(data:font/ttf;base64,${bodyFont.toString("base64")})}@font-face{font-family:Pixel;src:url(data:font/ttf;base64,${pixelFont.toString("base64")})}`;
const xml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const text = (
  value: string,
  x: number,
  y: number,
  className = "body",
  fill = "#000000",
) =>
  `<text class="${className}" fill="${fill}" x="${x}" y="${y}">${xml(value)}</text>`;
const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "#FFFFFF",
  stroke = "#E5E7EB",
  radius = 0,
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`;
const svg = (width: number, height: number, content: string) =>
  Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><style>${fontCss}.display{font-family:Display;font-weight:800}.bold{font-family:Bold;font-weight:700}.body{font-family:Body;font-weight:500}.small{font-family:Body;font-size:11px;font-weight:500}.tiny{font-family:Body;font-size:9px;font-weight:500}.caption{font-family:Display;font-weight:800;letter-spacing:-2px}.pixel{font-family:Pixel;font-weight:700}</style>${content}</svg>`,
  );

function homePatch(width: number, tablet: boolean) {
  if (!tablet)
    return svg(
      width,
      932,
      `${box(8, 45, 414, 155, "#FFFFFF", "#E5E7EB", 8)}${text("김서윤", 32, 76, "bold")}${text("모노톤 커피 로스터스 · 서울 성동구", 32, 102, "small", "#6B7280")}${text("전문분야  에스프레소 · 브루잉", 32, 126, "small")}${text("매일의 추출을 기록하고, 좋은 커피 경험을 나눕니다.", 32, 150, "small")}${text("☆ 128명이 즐겨찾기 하는 중", 32, 177, "small")}${box(8, 201, 414, 650, "#FFFFFF", "#FFFFFF")}${text("경력 사항 및 수상", 24, 225, "bold")}${text("2023-현재  ·  헤드 바리스타", 46, 260, "small", "#6B7280")}${text("2024  ·  SCA Brewing Intermediate", 46, 294, "small", "#6B7280")}${text("포트폴리오", 24, 342, "bold")}${box(40, 358, 350, 82, "#FFFFFF", "#E5E7EB", 6)}${text("에티오피아 구지 워시드 추출 기록", 56, 390, "small")}${text("2026.07.18", 56, 416, "small", "#6B7280")}${box(40, 454, 350, 82, "#FFFFFF", "#E5E7EB", 6)}${text("콜롬비아 워시드 브루잉 레시피", 56, 486, "small")}${text("2026.07.05", 56, 512, "small", "#6B7280")}${box(40, 550, 350, 82, "#FFFFFF", "#E5E7EB", 6)}${text("서비스 루틴과 바 동선 기록", 56, 582, "small")}${text("2026.06.22", 56, 608, "small", "#6B7280")}${text("커피 프로필", 24, 680, "bold")}${text("머신  La Marzocco Linea PB", 46, 716, "small", "#6B7280")}${text("그라인더  Mahlkönig EK43", 46, 746, "small", "#6B7280")}${text("선호 원두  워시드 · 라이트 로스트", 46, 776, "small", "#6B7280")}`,
    );
  return svg(
    width,
    1139,
    `${box(24, 88, 984, 292, "#FFFFFF", "#E5E7EB", 8)}${text("김서윤", 64, 136, "bold")}${text("모노톤 커피 로스터스 · 서울 성동구", 64, 181, "body", "#6B7280")}${text("전문분야  에스프레소 · 브루잉", 64, 220, "body")}${text("매일의 추출을 기록하고, 좋은 커피 경험을 나눕니다.", 64, 259, "body")}${text("☆ 128명이 즐겨찾기 하는 중", 64, 325, "body")}${box(24, 400, 984, 739, "#FFFFFF", "#FFFFFF")}${text("경력 사항 및 수상", 24, 440, "bold")}${text("2023-현재  ·  헤드 바리스타", 54, 500, "body", "#6B7280")}${text("2024  ·  SCA Brewing Intermediate", 54, 552, "body", "#6B7280")}${text("포트폴리오", 24, 650, "bold")}${box(46, 676, 940, 110, "#FFFFFF", "#E5E7EB", 6)}${text("에티오피아 구지 워시드 추출 기록", 70, 718, "bold")}${text("2026.07.18", 70, 756, "body", "#6B7280")}${box(46, 802, 940, 110, "#FFFFFF", "#E5E7EB", 6)}${text("콜롬비아 워시드 브루잉 레시피", 70, 844, "bold")}${text("2026.07.05", 70, 882, "body", "#6B7280")}${box(46, 928, 940, 110, "#FFFFFF", "#E5E7EB", 6)}${text("서비스 루틴과 바 동선 기록", 70, 970, "bold")}${text("2026.06.22", 70, 1008, "body", "#6B7280")}`,
  );
}

function mapPatch(width: number, height: number, tablet: boolean) {
  const pins = tablet
    ? [
        [400, 366],
        [650, 470],
        [760, 300],
      ]
    : [
        [180, 390],
        [272, 520],
        [315, 330],
      ];
  const card = tablet
    ? `${box(50, 835, 932, 175, "#FFFFFF", "#E5E7EB", 8)}${text("박도현", 80, 884, "bold")}${text("로스팅 · 브루잉", 80, 916, "body", "#6B7280")}${text("성수동 1.2km", 80, 947, "body", "#6B7280")}`
    : `${box(20, 676, 390, 148, "#FFFFFF", "#E5E7EB", 8)}${text("박도현", 44, 714, "bold")}${text("로스팅 · 브루잉", 44, 740, "small", "#6B7280")}${text("성수동 1.2km", 44, 763, "small", "#6B7280")}`;
  return svg(
    width,
    height,
    `${pins.map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="15" fill="#FF0000" stroke="#FFFFFF" stroke-width="3"/><path d="M0 14v16" stroke="#FF0000" stroke-width="6" stroke-linecap="round"/></g>`).join("")}${card}`,
  );
}

function calendarPatch(width: number, tablet: boolean) {
  const tab = tablet
    ? `<rect x="205" y="75" width="120" height="40" fill="#FFFFFF"/>`
    : `<rect x="205" y="75" width="80" height="40" fill="#FFFFFF"/>`;
  const events = tablet
    ? `${box(18, 860, 996, 279, "#FFFFFF", "#FFFFFF")}${text("이번 주 일정", 24, 902, "bold")}${box(24, 922, 984, 72, "#FFFFFF", "#E5E7EB", 6)}${text("07.30  월간 커핑: 에티오피아 워시드", 48, 950, "bold")}${text("성수 커피랩", 48, 976, "small", "#6B7280")}${box(24, 1010, 984, 72, "#FFFFFF", "#E5E7EB", 6)}${text("08.01  브루잉 레시피 교환회", 48, 1038, "bold")}${text("연남 브루잉룸", 48, 1064, "small", "#6B7280")}`
    : `${box(0, 590, 430, 270, "#FFFFFF", "#FFFFFF")}${text("이번 주 일정", 24, 624, "bold")}${box(24, 642, 382, 70, "#FFFFFF", "#E5E7EB", 6)}${text("07.30  월간 커핑: 에티오피아 워시드", 42, 668, "small")}${text("성수 커피랩", 42, 690, "small", "#6B7280")}${box(24, 726, 382, 70, "#FFFFFF", "#E5E7EB", 6)}${text("08.01  브루잉 레시피 교환회", 42, 752, "small")}${text("연남 브루잉룸", 42, 774, "small", "#6B7280")}`;
  return svg(width, tablet ? 1139 : 932, `${tab}${events}`);
}

function partnerPatch(width: number, tablet: boolean) {
  const rows = [
    [
      "2그룹 머신, 피크타임 스팀 압력 기록",
      "김서윤 · 에스프레소 머신",
      "3일 전",
      "184",
    ],
    [
      "매장용 그라인더 분쇄도 재현성 체크",
      "박도현 · 그라인더",
      "8일 전",
      "132",
    ],
    [
      "웨이브 드리퍼, 레시피별 추출 비교",
      "한유리 · 브루잉 도구",
      "2주 전",
      "96",
    ],
    [
      "페이퍼 린싱과 바이패스 추출 노트",
      "최민재 · 브루잉 도구",
      "2주 전",
      "71",
    ],
  ];
  const start = tablet ? 190 : 184;
  const rowHeight = tablet ? 162 : 132;
  const innerWidth = tablet ? 1032 : 430;
  return svg(
    width,
    tablet ? 1139 : 932,
    `${box(0, start - 12, innerWidth, tablet ? 920 : 690, "#FFFFFF", "#FFFFFF")}${rows
      .map((row, index) => {
        const y = start + index * rowHeight;
        return `${text(row[0], tablet ? 150 : 112, y + (tablet ? 32 : 27), "bold")}${text(`${row[1]} · ${row[2]}`, tablet ? 150 : 112, y + (tablet ? 65 : 53), "small", "#6B7280")}${text(`◉ ${row[3]}`, tablet ? 930 : 356, y + (tablet ? 65 : 53), "small", "#6B7280")}<path d="M${tablet ? 24 : 20} ${y + rowHeight - 12}H${tablet ? 1008 : 410}" stroke="#E5E7EB"/>`;
      })
      .join("")}`,
  );
}

function mypagePatch(width: number, tablet: boolean) {
  return tablet
    ? svg(
        width,
        1139,
        `${box(24, 88, 984, 210, "#FFFFFF", "#E5E7EB", 8)}${text("김서윤", 64, 142, "bold")}${text("모노톤 커피 로스터스 · 서울 성동구", 64, 187, "body", "#6B7280")}${text("전문분야  에스프레소 · 브루잉", 64, 228, "body")}${text("매일의 추출을 기록하고, 좋은 커피 경험을 나눕니다.", 64, 267, "body", "#6B7280")}`,
      )
    : svg(
        width,
        932,
        `${box(8, 45, 414, 142, "#FFFFFF", "#E5E7EB", 8)}${text("김서윤", 32, 78, "bold")}${text("모노톤 커피 로스터스 · 서울 성동구", 32, 103, "small", "#6B7280")}${text("전문분야  에스프레소 · 브루잉", 32, 126, "small")}${text("매일의 추출을 기록하고, 좋은 커피 경험을 나눕니다.", 32, 150, "tiny", "#6B7280")}`,
      );
}

async function buildRaw() {
  await mkdir(raw, { recursive: true });
  const reviewPhotos = await Promise.all(
    reviewPhotoUrls.map(async (url) => {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      assert.ok(response.ok, `리뷰 사진 다운로드 실패: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    }),
  );
  await Promise.all(
    ["430x932", "1032x1376"].flatMap((format) => {
      const tablet = format === "1032x1376";
      return screens.map(async ([name]) => {
        const input = resolve(sourceRaw, `${name}-${format}-ready.png`);
        const metadata = await sharp(input).metadata();
        const width = metadata.width!;
        const height = metadata.height!;
        const patch =
          name === "home"
            ? homePatch(width, tablet)
            : name === "map"
              ? mapPatch(width, height, tablet)
              : name === "calendar"
                ? calendarPatch(width, tablet)
                : name === "partner-reviews"
                  ? partnerPatch(width, tablet)
                  : mypagePatch(width, tablet);
        const thumbnails =
          name === "partner-reviews"
            ? await Promise.all(
                reviewPhotos.map(async (photo, index) => ({
                  input: await sharp(photo)
                    .resize({
                      width: tablet ? 104 : 76,
                      height: tablet ? 104 : 76,
                      fit: "cover",
                    })
                    .png()
                    .toBuffer(),
                  left: tablet ? 24 : 20,
                  top: (tablet ? 190 : 184) + index * (tablet ? 162 : 132),
                })),
              )
            : [];
        await sharp(input)
          .composite([{ input: patch, left: 0, top: 0 }, ...thumbnails])
          .flatten({ background: "#FFFFFF" })
          .removeAlpha()
          .png({ palette: false, compressionLevel: 9 })
          .toFile(resolve(raw, `${name}-${format}-ready.png`));
      });
    }),
  );
}

function copySvg(
  width: number,
  height: number,
  headline: string,
  background: string,
) {
  const size = width === 2064 ? 120 : width === 1320 ? 100 : 70;
  const x = width === 2064 ? 132 : width === 1320 ? 96 : 80;
  const y = width === 2064 ? 250 : width === 1320 ? 245 : 195;
  const leading = size * 1.13;
  const markWidth = Math.round(size * 0.54);
  const markHeight = Math.max(6, Math.round(size * 0.065));
  return svg(
    width,
    height,
    `<rect width="100%" height="100%" fill="${background}"/><rect x="${x}" y="${y - size - Math.round(size * 0.42)}" width="${markWidth}" height="${markHeight}" fill="#FF0000"/>${headline
      .split("\n")
      .map(
        (line, index) =>
          `<text class="caption" fill="#000000" font-size="${size}" x="${x}" y="${y + index * leading}">${xml(line)}</text>`,
      )
      .join("")}`,
  );
}

async function pixelArt(width: number, foreground: 0 | 255) {
  let source = sharp(resolve(root, "app/assets/splash-baristas.png"));
  const { data, info } = await source
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] > 244 && data[index + 1] > 244 && data[index + 2] > 244)
      data[index + 3] = 0;
    else if (
      data[index] > 160 &&
      data[index + 1] < 100 &&
      data[index + 2] < 100
    )
      [data[index], data[index + 1], data[index + 2]] = [255, 0, 0];
    else
      [data[index], data[index + 1], data[index + 2]] = [
        foreground,
        foreground,
        foreground,
      ];
  }
  return sharp(data, { raw: info })
    .resize({ width, kernel: "nearest" })
    .png()
    .toBuffer();
}

async function blackArt(width: number) {
  return sharp(await pixelArt(width, 0))
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width, kernel: "nearest" })
    .png()
    .toBuffer();
}

async function buildSplash(
  name: keyof typeof layouts,
  layout: (typeof layouts)[keyof typeof layouts],
) {
  const x = name === "ipad" ? 132 : name === "iphone" ? 96 : 80;
  const titleSize = name === "ipad" ? 120 : name === "iphone" ? 100 : 70;
  const copy = svg(
    layout.width,
    layout.height,
    `<rect width="100%" height="100%" fill="#F3F4F6"/><rect x="${x}" y="${name === "ipad" ? 92 : name === "iphone" ? 88 : 72}" width="${Math.round(titleSize * 0.54)}" height="${Math.max(6, Math.round(titleSize * 0.065))}" fill="#FF0000"/><text class="pixel" fill="#000000" font-size="${name === "ipad" ? 44 : name === "iphone" ? 40 : 28}" x="${x}" y="${name === "ipad" ? 165 : name === "iphone" ? 160 : 135}">BLENDING</text><text class="caption" fill="#000000" font-size="${titleSize}" x="${x}" y="${name === "ipad" ? 320 : name === "iphone" ? 285 : 230}">커피 커리어가</text><text class="caption" fill="#000000" font-size="${titleSize}" x="${x}" y="${name === "ipad" ? 458 : name === "iphone" ? 400 : 310}">서로를 만나는 곳</text>`,
  );
  const artWidth = name === "ipad" ? 2380 : name === "iphone" ? 1660 : 1280;
  const fullArt = await blackArt(artWidth);
  const fullArtInfo = await sharp(fullArt).metadata();
  const art = await sharp(fullArt)
    .extract({
      left: Math.round((fullArtInfo.width! - layout.width) / 2),
      top: 0,
      width: layout.width,
      height: fullArtInfo.height!,
    })
    .png()
    .toBuffer();
  const artInfo = await sharp(art).metadata();
  const top =
    layout.height -
    artInfo.height! -
    (name === "ipad" ? 80 : name === "iphone" ? 110 : 60);
  const subSize = name === "ipad" ? 40 : name === "iphone" ? 40 : 28;
  const sub = svg(
    layout.width,
    layout.height,
    `<text class="body" fill="#6B7280" font-size="${subSize}" x="${x}" y="${name === "ipad" ? 560 : name === "iphone" ? 495 : 410}">경력을 기록하고, 사람과 기회를 발견하세요</text>`,
  );
  await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: "#F3F4F6",
    },
  })
    .composite([
      { input: copy, left: 0, top: 0 },
      { input: sub, left: 0, top: 0 },
      { input: art, left: 0, top },
    ])
    .flatten({ background: "#FFFFFF" })
    .removeAlpha()
    .png({ palette: false, compressionLevel: 9 })
    .toFile(resolve(output, name, "01.png"));
}

async function buildPlatform(
  name: keyof typeof layouts,
  layout: (typeof layouts)[keyof typeof layouts],
) {
  await mkdir(resolve(output, name), { recursive: true });
  await buildSplash(name, layout);
  await Promise.all(
    screens.map(async ([screen, headline], index) => {
      const treatment = treatments[index];
      const top = Math.round(layout.screenY + layout.height * treatment.y);
      const source = resolve(
        raw,
        `${screen}-${name === "ipad" ? "1032x1376" : "430x932"}-ready.png`,
      );
      const fullApp = await sharp(source)
        .resize({
          width: Math.round(layout.screenWidth * treatment.scale),
          withoutEnlargement: false,
        })
        .flatten({ background: "#FFFFFF" })
        .removeAlpha()
        .png()
        .toBuffer();
      const fullAppInfo = await sharp(fullApp).metadata();
      const appBase =
        fullAppInfo.height! > layout.height - top
          ? await sharp(fullApp)
              .extract({
                left: 0,
                top: 0,
                width: fullAppInfo.width!,
                height: layout.height - top,
              })
              .png()
              .toBuffer()
          : fullApp;
      const baseInfo = await sharp(appBase).metadata();
      const radius = Math.round(layout.width * 0.018);
      const mask = svg(
        baseInfo.width!,
        baseInfo.height!,
        `<rect width="100%" height="100%" rx="${radius}" fill="#FFFFFF"/>`,
      );
      const border = svg(
        baseInfo.width!,
        baseInfo.height!,
        `<rect x="1" y="1" width="${baseInfo.width! - 2}" height="${baseInfo.height! - 2}" rx="${radius}" fill="none" stroke="#E5E7EB" stroke-width="2"/>`,
      );
      const app = await sharp(appBase)
        .composite([
          { input: mask, blend: "dest-in" },
          { input: border, left: 0, top: 0 },
        ])
        .png()
        .toBuffer();
      const left = Math.round(
        (layout.width - baseInfo.width!) / 2 + layout.width * treatment.shift,
      );
      await sharp({
        create: {
          width: layout.width,
          height: layout.height,
          channels: 3,
          background: treatment.background,
        },
      })
        .composite([
          {
            input: copySvg(
              layout.width,
              layout.height,
              headline,
              treatment.background,
            ),
            left: 0,
            top: 0,
          },
          { input: app, left, top },
        ])
        .flatten({ background: "#FFFFFF" })
        .removeAlpha()
        .png({ palette: false, compressionLevel: 9 })
        .toFile(
          resolve(output, name, `${String(index + 2).padStart(2, "0")}.png`),
        );
    }),
  );
}

async function buildFeatureGraphic() {
  const art = await blackArt(500);
  const base = svg(
    1024,
    500,
    `<rect width="100%" height="100%" fill="#F3F4F6"/><rect x="72" y="58" width="30" height="5" fill="#FF0000"/><text class="pixel" fill="#000000" font-size="23" x="72" y="104">BLENDING</text><text class="caption" fill="#000000" font-size="54" x="72" y="205">커피 커리어가</text><text class="caption" fill="#000000" font-size="54" x="72" y="272">서로를 만나는 곳</text><text class="body" fill="#6B7280" font-size="22" x="72" y="335">경력을 기록하고, 사람과 기회를 발견하세요</text>`,
  );
  await sharp({
    create: { width: 1024, height: 500, channels: 3, background: "#F3F4F6" },
  })
    .composite([
      { input: base, left: 0, top: 0 },
      { input: art, left: 535, top: 48 },
    ])
    .flatten({ background: "#FFFFFF" })
    .removeAlpha()
    .png({ palette: false, compressionLevel: 9 })
    .toFile(resolve(output, "android/feature-graphic-1024x500.png"));
}

await buildRaw();
await Promise.all(
  Object.entries(layouts).map(([name, layout]) =>
    buildPlatform(name as keyof typeof layouts, layout),
  ),
);
await buildFeatureGraphic();

for (const [name, layout] of Object.entries(layouts))
  for (let index = 1; index <= 6; index += 1) {
    const file = resolve(output, name, `${String(index).padStart(2, "0")}.png`);
    const metadata = await sharp(file).metadata();
    assert.deepEqual(
      [metadata.width, metadata.height, metadata.hasAlpha],
      [layout.width, layout.height, false],
      file,
    );
  }
const feature = await sharp(
  resolve(output, "android/feature-graphic-1024x500.png"),
).metadata();
assert.deepEqual(
  [feature.width, feature.height, feature.hasAlpha],
  [1024, 500, false],
  "Android feature graphic",
);
console.log("Generated and verified 19 store assets.");
