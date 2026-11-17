import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "web/package.json"));
const sharp = require("sharp");
const raw = resolve(root, "docs/store-assets/raw");
const output = resolve(root, "docs/store-assets/final");

const screens = [
  ["login", "BLENDING", "커피로 연결되는\n새로운 시작"],
  ["map", "NEARBY", "내 주변 바리스타를\n한눈에"],
  ["calendar", "CALENDAR", "커피 일정과 모임을\n놓치지 않게"],
  ["home", "PROFILE", "경력과 취향을 담은\n나만의 커피 프로필"],
  ["partner-reviews", "PARTNER", "파트너의 장비 리뷰를\n한곳에서"],
  ["mypage", "MY BLENDING", "내 활동과 설정을\n간편하게"],
];

const layouts = {
  android: {
    width: 1080,
    height: 1920,
    screenWidth: 728,
    screenY: 340,
    copyX: 80,
    kickerY: 104,
    kickerSize: 30,
    titleY: 193,
    titleSize: 74,
    titleLeading: 84,
    offsets: [-22, 18],
  },
  iphone: {
    width: 1320,
    height: 2868,
    screenWidth: 1078,
    screenY: 510,
    copyX: 96,
    kickerY: 124,
    kickerSize: 40,
    titleY: 225,
    titleSize: 108,
    titleLeading: 126,
    offsets: [-28, 26],
  },
  ipad: {
    width: 2064,
    height: 2752,
    screenWidth: 1798,
    screenY: 470,
    copyX: 132,
    kickerY: 106,
    kickerSize: 32,
    titleY: 194,
    titleSize: 88,
    titleLeading: 106,
    offsets: [-42, 38],
  },
};

const [displayFont, bodyFont] = await Promise.all([
  readFile(resolve(root, "web/public/fonts/SeoulNamsanEB.ttf")),
  readFile(resolve(root, "web/public/fonts/SeoulNamsanM.ttf")),
]);

const fontCss = `@font-face{font-family:Display;src:url(data:font/ttf;base64,${displayFont.toString("base64")}) format('truetype');font-weight:800}@font-face{font-family:Body;src:url(data:font/ttf;base64,${bodyFont.toString("base64")}) format('truetype');font-weight:500}`;
const xml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function copySvg(number, kicker, headline, layout) {
  const title = headline
    .split("\n")
    .map(
      (line, index) =>
        `<text x="${layout.copyX}" y="${layout.titleY + index * layout.titleLeading}">${xml(line)}</text>`,
    )
    .join("");
  return Buffer.from(
    `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg"><style>${fontCss}text{fill:#000;font-family:Display;font-size:${layout.titleSize}px;font-weight:800;letter-spacing:-1.5px}.meta{font-family:Body;font-size:${layout.kickerSize}px;font-weight:500;letter-spacing:${Math.round(layout.kickerSize * 0.14)}px}.number{fill:#FF0000}.kicker{fill:#6B7280}</style><text class="meta number" x="${layout.copyX}" y="${layout.kickerY}">${number}</text><text class="meta kicker" x="${layout.copyX + layout.kickerSize * 2.9}" y="${layout.kickerY}">${kicker}</text>${title}</svg>`,
  );
}

async function framed(input, width) {
  const image = await sharp(input)
    .resize({ width: width - 2 })
    .flatten({ background: "#FFFFFF" })
    .extend({ top: 1, bottom: 1, left: 1, right: 1, background: "#F3F4F6" })
    .png()
    .toBuffer();
  const metadata = await sharp(image).metadata();
  const mask = Buffer.from(
    `<svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="8" fill="#fff"/></svg>`,
  );
  return sharp(image)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function buildPlatform(name, layout) {
  const directory = resolve(output, name);
  await mkdir(directory, { recursive: true });
  await Promise.all(
    screens.map(async ([screen, kicker, headline], index) => {
      const source = resolve(
        raw,
        `${screen}-${name === "ipad" ? "1032x1376" : "430x932"}-ready.png`,
      );
      const app = await framed(source, layout.screenWidth);
      const info = await sharp(app).metadata();
      const left = Math.round(
        (layout.width - info.width) / 2 +
          layout.offsets[index % layout.offsets.length],
      );
      await sharp({
        create: {
          width: layout.width,
          height: layout.height,
          channels: 3,
          background: "#FFFFFF",
        },
      })
        .composite([
          {
            input: copySvg(
              String(index + 1).padStart(2, "0"),
              kicker,
              headline,
              layout,
            ),
            top: 0,
            left: 0,
          },
          { input: app, top: layout.screenY, left },
        ])
        .flatten({ background: "#FFFFFF" })
        .removeAlpha()
        .png({ palette: false, compressionLevel: 9 })
        .toFile(
          resolve(directory, `${String(index + 1).padStart(2, "0")}.png`),
        );
    }),
  );
}

async function buildFeatureGraphic() {
  const directory = resolve(output, "android");
  const appFrame = await framed(resolve(raw, "home-430x932-ready.png"), 278);
  const app = await sharp(appFrame)
    .extract({ left: 0, top: 0, width: 278, height: 228 })
    .png()
    .toBuffer();
  const logo = await sharp(resolve(root, "app/assets/splash-logo.png"))
    .resize({ width: 200, height: 200, fit: "contain" })
    .png()
    .toBuffer();
  const text = Buffer.from(
    `<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg"><style>${fontCss}text{font-family:Display;font-size:56px;font-weight:800;letter-spacing:-1px}.meta{font-family:Body;font-size:20px;font-weight:500;letter-spacing:3px;fill:#6B7280}</style><text class="meta" x="72" y="146">BLENDING</text><text x="72" y="232">커피로 연결되는 사람들</text></svg>`,
  );
  await sharp({
    create: { width: 1024, height: 500, channels: 3, background: "#FAFAFA" },
  })
    .composite([
      { input: text, top: 0, left: 0 },
      { input: logo, top: 0, left: 760 },
      { input: app, top: 272, left: 674 },
    ])
    .flatten({ background: "#FAFAFA" })
    .removeAlpha()
    .png({ palette: false, compressionLevel: 9 })
    .toFile(resolve(directory, "feature-graphic-1024x500.png"));
}

await Promise.all(
  Object.entries(layouts).map(([name, layout]) => buildPlatform(name, layout)),
);
await buildFeatureGraphic();

for (const [name, layout] of Object.entries(layouts)) {
  for (let index = 1; index <= screens.length; index += 1) {
    const path = resolve(output, name, `${String(index).padStart(2, "0")}.png`);
    const metadata = await sharp(path).metadata();
    assert.deepEqual(
      [metadata.width, metadata.height, metadata.hasAlpha],
      [layout.width, layout.height, false],
      path,
    );
  }
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
