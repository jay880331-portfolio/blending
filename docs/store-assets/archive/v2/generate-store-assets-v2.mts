import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "web/package.json"));
const sharp = require("sharp");
const output = resolve(root, "docs/store-assets/final");

const sizes = {
  android: { width: 1080, height: 1920, wide: false },
  iphone: { width: 1320, height: 2868, wide: false },
  ipad: { width: 2064, height: 2752, wide: true },
};

const [display, bold, body, pixel] = await Promise.all([
  readFile(resolve(root, "web/public/fonts/SeoulNamsanEB.ttf")),
  readFile(resolve(root, "web/public/fonts/SeoulNamsanB.ttf")),
  readFile(resolve(root, "web/public/fonts/SeoulNamsanM.ttf")),
  readFile(resolve(root, "web/public/fonts/Galmuri11.ttf")),
]);

const fontCss = `@font-face{font-family:Display;src:url(data:font/ttf;base64,${display.toString("base64")})}@font-face{font-family:Bold;src:url(data:font/ttf;base64,${bold.toString("base64")})}@font-face{font-family:Body;src:url(data:font/ttf;base64,${body.toString("base64")})}@font-face{font-family:Pixel;src:url(data:font/ttf;base64,${pixel.toString("base64")})}`;
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const svg = (width: number, height: number, body: string) =>
  Buffer.from(
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><style>${fontCss}.title{font-family:Display;font-size:76px;font-weight:800;letter-spacing:-3px}.sub{font-family:Body;font-size:30px;font-weight:500;letter-spacing:-.4px}.label{font-family:Bold;font-size:24px;font-weight:700;letter-spacing:-.5px}.small{font-family:Body;font-size:20px;font-weight:500}.brand{font-family:Pixel;font-size:23px;letter-spacing:-1px}</style>${body}</svg>`,
  );
const textLines = (
  text: string,
  x: number,
  y: number,
  className: string,
  leading: number,
  fill = "#000000",
) =>
  text
    .split("\n")
    .map(
      (line, index) =>
        `<text class="${className}" fill="${fill}" x="${x}" y="${y + index * leading}">${escape(line)}</text>`,
    )
    .join("");
const wordmark = (x: number, y: number, fill: string) =>
  `<text class="brand" fill="${fill}" x="${x}" y="${y}">BLENDING</text>`;
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "#FFFFFF",
  stroke = "#000000",
  radius = 0,
) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;

async function pixelArt(file: string, color: string, width: number) {
  const source = sharp(resolve(root, "app/assets", file)).ensureAlpha();
  const { data, info } = await source
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = color
    .match(/[a-f\d]{2}/gi)!
    .map((part) => Number.parseInt(part, 16));
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] > 244 && data[index + 1] > 244 && data[index + 2] > 244)
      data[index + 3] = 0;
    else [data[index], data[index + 1], data[index + 2]] = [r, g, b];
  }
  return sharp(data, { raw: info })
    .resize({ width, kernel: "nearest" })
    .png()
    .toBuffer();
}

function mapScene(width: number, height: number, wide: boolean) {
  const x = wide ? 1040 : 54;
  const y = wide ? 560 : 690;
  const w = wide ? 900 : width - 108;
  const h = wide ? 1280 : height - y - 120;
  const roads = [
    `<path d="M${x - 70} ${y + 280} C${x + 160} ${y + 230},${x + 300} ${y + 390},${x + w + 80} ${y + 310}" fill="none" stroke="#6B7280" stroke-width="3"/>`,
    `<path d="M${x + 80} ${y + h + 20} C${x + 200} ${y + 690},${x + w - 190} ${y + 680},${x + w + 40} ${y + 540}" fill="none" stroke="#6B7280" stroke-width="3"/>`,
    `<path d="M${x + 170} ${y + 80} L${x + 260} ${y + h - 70} M${x + 530} ${y + 50} L${x + 440} ${y + h}" fill="none" stroke="#F3F4F6" stroke-width="18"/>`,
  ].join("");
  const chips = ["에스프레소", "브루잉", "라테아트"]
    .map(
      (label, index) =>
        `${rect(x + 30 + index * 202, y + 105, 184, 60, "#FFFFFF", "#000000", 8)}<text class="small" x="${x + 80 + index * 202}" y="${y + 144}">${label}</text>`,
    )
    .join("");
  return svg(
    width,
    height,
    `<rect width="100%" height="100%" fill="#FAFAFA"/>${wordmark(wide ? 100 : 54, 74, "#000000")}${textLines("가까운 커피인은\n생각보다 더 가까이.", wide ? 100 : 54, wide ? 250 : 218, "title", 92)}${textLines("내 주변 바리스타와 커피인을 지도로 발견해요.", wide ? 100 : 54, wide ? 455 : 420, "sub", 40, "#6B7280")}${rect(x, y, w, h, "#FFFFFF", "#000000", 8)}${roads}${rect(x + 24, y + 24, w - 48, 66, "#FFFFFF", "#000000", 8)}<circle cx="${x + 58}" cy="${y + 57}" r="10" fill="none" stroke="#000000" stroke-width="3"/><path d="M${x + 66} ${y + 65}l8 8" stroke="#000000" stroke-width="3"/>${chips}<g fill="#FF0000" stroke="#000000" stroke-width="2"><path d="M${x + w * 0.3} ${y + h * 0.52}c-18 0-30-13-30-30 0-17 12-30 30-30s30 13 30 30c0 25-30 50-30 50z"/><circle cx="${x + w * 0.3}" cy="${y + h * 0.52}" r="8" fill="#FFFFFF"/><path d="M${x + w * 0.68} ${y + h * 0.68}c-18 0-30-13-30-30 0-17 12-30 30-30s30 13 30 30c0 25-30 50-30 50z"/><circle cx="${x + w * 0.68}" cy="${y + h * 0.68}" r="8" fill="#FFFFFF"/></g>`,
  );
}

function calendarScene(width: number, height: number, wide: boolean) {
  const x = wide ? 990 : 54;
  const y = wide ? 570 : 690;
  const w = wide ? 960 : width - 108;
  const cellW = (w - 52) / 7;
  const cells = Array.from({ length: 35 }, (_, index) => {
    const col = index % 7;
    const row = Math.floor(index / 7);
    const cx = x + 26 + col * cellW + cellW / 2;
    const cy = y + 175 + row * 116;
    const colors = ["#FFD700", "#4A90E2", "#50E3C2"];
    return `<text class="small" fill="#000000" x="${cx - 7}" y="${cy}">${(index % 30) + 1}</text>${index % 3 === 1 ? `<circle cx="${cx}" cy="${cy + 28}" r="6" fill="${colors[index % 3]}"/>` : ""}`;
  }).join("");
  return svg(
    width,
    height,
    `<rect width="100%" height="100%" fill="#FFFFFF"/>${wordmark(wide ? 100 : 54, 74, "#000000")}${textLines("좋은 커피가 있는 곳엔,\n늘 사람이 모이니까.", wide ? 100 : 54, wide ? 250 : 218, "title", 92)}${textLines("대회, 세미나, 작은 모임까지 한눈에.", wide ? 100 : 54, wide ? 455 : 420, "sub", 40, "#6B7280")}${rect(x, y, w, wide ? 760 : 760, "#FFFFFF", "#000000", 0)}<text class="label" x="${x + 26}" y="${y + 58}">커피 캘린더</text><path d="M${x + 26} ${y + 88}H${x + w - 26}" stroke="#000000"/>${[0, 1, 2, 3, 4, 5].map((row) => `<path d="M${x + 26} ${y + 112 + row * 116}H${x + w - 26}" stroke="#F3F4F6"/>`).join("")}${Array.from({ length: 6 }, (_, index) => `<path d="M${x + 26 + index * cellW} ${y + 112}V${y + 692}" stroke="#F3F4F6"/>`).join("")}${cells}<circle cx="${x + 32}" cy="${y + 735}" r="6" fill="#FFD700"/><text class="small" x="${x + 46}" y="${y + 742}">공식</text><circle cx="${x + 156}" cy="${y + 735}" r="6" fill="#4A90E2"/><text class="small" x="${x + 170}" y="${y + 742}">세미나</text><circle cx="${x + 300}" cy="${y + 735}" r="6" fill="#50E3C2"/><text class="small" x="${x + 314}" y="${y + 742}">모임</text>`,
  );
}

function profileScene(width: number, height: number, wide: boolean) {
  const x = wide ? 1010 : 54;
  const y = wide ? 560 : 690;
  const w = wide ? 920 : width - 108;
  const card = (offset: number, title: string, lines = 2) =>
    `${rect(x, y + offset, w, 128 + lines * 28, "#FFFFFF", "#FFFFFF", 0)}<text class="label" x="${x + 30}" y="${y + offset + 48}">${title}</text>${Array.from({ length: lines }, (_, i) => `<path d="M${x + 30} ${y + offset + 78 + i * 25}H${x + w - 60 - i * 110}" stroke="#6B7280" stroke-width="5"/>`).join("")}`;
  return svg(
    width,
    height,
    `<rect width="100%" height="100%" fill="#0E0E0E"/>${wordmark(wide ? 100 : 54, 74, "#E2E2E2")}${textLines("말보다 먼저 보여주는,\n나의 커피 이력.", wide ? 100 : 54, wide ? 250 : 218, "title", 92, "#FFFFFF")}${textLines("경력, 수상, 장비, 포트폴리오를 하나의 프로필로.", wide ? 100 : 54, wide ? 455 : 420, "sub", 40, "#E2E2E2")}${card(0, "커피 프로필", 1)}${card(235, "전문분야")}${card(510, "장비")}${card(785, "포트폴리오")}<path d="M${x + w - 72} ${y + 38}h32v32h-32z" fill="#FF5540"/>`,
  );
}

function partnerScene(width: number, height: number, wide: boolean) {
  const x = wide ? 1000 : 54;
  const y = wide ? 560 : 690;
  const w = wide ? 940 : width - 108;
  const item = (offset: number, title: string, icon: string) =>
    `${rect(x, y + offset, w, 190, "#FFFFFF", "#000000", 0)}<g transform="translate(${x + 32} ${y + offset + 38})" fill="none" stroke="#000000" stroke-width="4">${icon}</g><text class="label" x="${x + 150}" y="${y + offset + 78}">${title}</text><path d="M${x + 150} ${y + offset + 112}H${x + w - 42}" stroke="#F3F4F6" stroke-width="7"/><path d="M${x + 150} ${y + offset + 138}H${x + w - 180}" stroke="#F3F4F6" stroke-width="7"/>`;
  const machine = `<rect x="2" y="18" width="76" height="62"/><path d="M18 18V2h38v16M78 42h20v30H78M22 48h25"/>`;
  const grinder = `<path d="M18 82h60M32 82V38h32v44M24 20h48v18H24zM48 38V8"/>`;
  const brew = `<path d="M20 12h56l-10 28H30zM32 40h32l8 42H24zM16 82h64"/>`;
  return svg(
    width,
    height,
    `<rect width="100%" height="100%" fill="#FAFAFA"/>${wordmark(wide ? 100 : 54, 74, "#000000")}${textLines("써본 사람의 한마디가,\n다음 장비를 고른다.", wide ? 100 : 54, wide ? 250 : 218, "title", 92)}${textLines("현장의 리뷰와 파트너 소식을 한곳에서.", wide ? 100 : 54, wide ? 455 : 420, "sub", 40, "#6B7280")}${rect(x, y, w, 82, "#FFFFFF", "#000000", 0)}<text class="label" x="${x + 50}" y="${y + 52}">홍보관</text><text class="label" x="${x + 180}" y="${y + 52}" fill="#FF0000">리뷰관</text><path d="M${x + 176} ${y + 70}h74" stroke="#FF0000" stroke-width="4"/>${["에스프레소 머신", "그라인더", "브루잉 도구"].map((label, index) => `${rect(x + index * (wide ? 220 : 200), y + 108, wide ? 202 : 182, 52, "#FFFFFF", "#000000", 8)}<text class="small" x="${x + 16 + index * (wide ? 220 : 200)}" y="${y + 142}">${label}</text>`).join("")}${item(210, "에스프레소 머신", machine)}${item(430, "그라인더", grinder)}${item(650, "브루잉 도구", brew)}`,
  );
}

async function scene(
  number: number,
  size: { width: number; height: number; wide: boolean },
) {
  const { width, height, wide } = size;
  const pieces: { input: Buffer; left: number; top: number }[] = [];
  const art = async (
    file: string,
    color: string,
    artWidth: number,
    left: number,
    top: number,
  ) => pieces.push({ input: await pixelArt(file, color, artWidth), left, top });
  const base = (() => {
    const tx = wide ? 120 : 58;
    if (number === 1)
      return svg(
        width,
        height,
        `<rect width="100%" height="100%" fill="#FF0000"/>${wordmark(wide ? 122 : 58, 76, "#FFFFFF")}${textLines("커피로 만나고,\n사람으로 이어지다.", tx, wide ? 280 : 238, "title", 94, "#FFFFFF")}${textLines("커피하는 사람들의 커뮤니티, BLENDING", tx, wide ? 500 : 438, "sub", 40, "#FFFFFF")}`,
      );
    if (number === 2) return mapScene(width, height, wide);
    if (number === 3) return calendarScene(width, height, wide);
    if (number === 4) return profileScene(width, height, wide);
    if (number === 5) return partnerScene(width, height, wide);
    return svg(
      width,
      height,
      `<rect width="100%" height="100%" fill="#0E0E0E"/>${wordmark(wide ? 122 : 58, 76, "#E2E2E2")}${textLines("혼자 깊어지지 않도록.\n커피하는 사람들의 연결.", tx, wide ? 280 : 238, "title", 94, "#FFFFFF")}`,
    );
  })();
  if (number === 1)
    await art(
      "splash-baristas.png",
      "#000000",
      wide ? 930 : width - 90,
      wide ? 1010 : 44,
      wide ? 820 : Math.min(height - 820, 880),
    );
  if (number === 3)
    await art(
      "splash-baristas-mid.png",
      "#000000",
      wide ? 520 : 340,
      wide ? 315 : width - 410,
      wide ? 1590 : height - 450,
    );
  if (number === 6)
    await art(
      wide ? "splash-baristas-rest.png" : "splash-baristas-sip.png",
      "#FF5540",
      wide ? 970 : width - 120,
      wide ? 980 : 60,
      wide ? 890 : Math.min(height - 850, 900),
    );
  if (number === 2) {
    const positions = wide
      ? [
          [1090, 680],
          [1292, 680],
          [1494, 680],
        ]
      : [
          [84, 795],
          [286, 795],
          [488, 795],
        ];
    const icons = ["espresso.webp", "brewing.webp", "latte-art.webp"];
    await Promise.all(
      icons.map(async (file, index) =>
        pieces.push({
          input: await sharp(
            resolve(root, "web/public/images/map-filters", file),
          )
            .resize({ width: 48, height: 48 })
            .png()
            .toBuffer(),
          left: positions[index][0],
          top: positions[index][1],
        }),
      ),
    );
  }
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background:
        number === 1
          ? "#FF0000"
          : number === 4 || number === 6
            ? "#0E0E0E"
            : "#FFFFFF",
    },
  })
    .composite([{ input: base, left: 0, top: 0 }, ...pieces])
    .flatten({ background: "#FFFFFF" })
    .removeAlpha()
    .png({ palette: false, compressionLevel: 9 });
}

async function buildPlatform(
  name: keyof typeof sizes,
  size: (typeof sizes)[keyof typeof sizes],
) {
  const directory = resolve(output, name);
  await mkdir(directory, { recursive: true });
  const scale = size.wide ? 1 : size.width / 1080;
  const canvas = {
    ...size,
    width: Math.round(size.width / scale),
    height: Math.round(size.height / scale),
  };
  await Promise.all(
    Array.from({ length: 6 }, async (_, index) =>
      scene(index + 1, canvas).then((image) =>
        image
          .resize({ width: size.width, height: size.height, fit: "fill" })
          .toFile(
            resolve(directory, `${String(index + 1).padStart(2, "0")}.png`),
          ),
      ),
    ),
  );
}

async function featureGraphic() {
  const art = await pixelArt("splash-baristas.png", "#000000", 430);
  const image = svg(
    1024,
    500,
    `<rect width="100%" height="100%" fill="#FF0000"/>${wordmark(72, 76, "#FFFFFF")}${textLines("커피하는 사람들의\n가장 진한 연결", 72, 206, "title", 82, "#FFFFFF")}`,
  );
  await sharp({
    create: { width: 1024, height: 500, channels: 3, background: "#FF0000" },
  })
    .composite([
      { input: image, left: 0, top: 0 },
      { input: art, left: 580, top: 74 },
    ])
    .flatten({ background: "#FF0000" })
    .removeAlpha()
    .png({ palette: false, compressionLevel: 9 })
    .toFile(resolve(output, "android/feature-graphic-1024x500.png"));
}

await Promise.all(
  Object.entries(sizes).map(([name, size]) =>
    buildPlatform(name as keyof typeof sizes, size),
  ),
);
await featureGraphic();

for (const [name, size] of Object.entries(sizes))
  for (let index = 1; index <= 6; index += 1) {
    const file = resolve(output, name, `${String(index).padStart(2, "0")}.png`);
    const metadata = await sharp(file).metadata();
    assert.deepEqual(
      [metadata.width, metadata.height, metadata.hasAlpha],
      [size.width, size.height, false],
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
