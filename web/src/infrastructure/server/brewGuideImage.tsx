import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { BrewGuide } from "@/domain/brewGuide/brewGuide";
import { generateQrSvgDataUrl } from "./brewGuideQr";

// DESIGN.md 토큰 hex 값만 사용
const TOKENS = {
  surface: "#ffffff", // --surface / --bg
  surfaceAlt: "#fafafa", // --surface-alt
  fg: "#000000", // --fg
  fgStrong: "#000000", // --fg-strong
  fgMuted: "#6b7280", // --fg-muted
  fgSubtle: "#9ca3af", // --fg-subtle
  border: "#f3f4f6", // --border
  borderStrong: "#e5e7eb", // --border-strong
} as const;

type FontData = {
  medium: ArrayBuffer;
  bold: ArrayBuffer;
};

let fontCache: Promise<FontData> | undefined;

async function loadSeoulNamsanFonts(): Promise<FontData> {
  if (!fontCache) {
    fontCache = (async () => {
      const fontsDir = path.join(process.cwd(), "public", "fonts");
      const [mediumBuf, boldBuf] = await Promise.all([
        readFile(path.join(fontsDir, "SeoulNamsanM.ttf")),
        readFile(path.join(fontsDir, "SeoulNamsanB.ttf")),
      ]);
      return {
        medium: mediumBuf.buffer.slice(
          mediumBuf.byteOffset,
          mediumBuf.byteOffset + mediumBuf.byteLength,
        ),
        bold: boldBuf.buffer.slice(
          boldBuf.byteOffset,
          boldBuf.byteOffset + boldBuf.byteLength,
        ),
      };
    })();
  }
  return fontCache;
}

function RecipeRow({
  label,
  value,
  unit,
  s,
}: {
  label: string;
  value: string | number;
  unit?: string;
  s: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: `${12 * s}px 0`,
        borderBottom: `${1 * s}px solid ${TOKENS.border}`,
      }}
    >
      <span
        style={{
          fontSize: 20 * s,
          fontWeight: 500,
          color: TOKENS.fgMuted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "baseline",
          fontSize: 24 * s,
          fontWeight: 700,
          color: TOKENS.fgStrong,
        }}
      >
        <span>{String(value)}</span>
        {unit ? (
          <span
            style={{
              fontSize: 18 * s,
              fontWeight: 500,
              color: TOKENS.fgMuted,
              marginLeft: 4 * s,
            }}
          >
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export async function renderBrewGuideImageResponse(
  guide: BrewGuide,
  {
    showroomUrl,
    scale = 1,
  }: {
    showroomUrl: string;
    scale?: 1 | 2;
  },
): Promise<ImageResponse> {
  const s = scale === 2 ? 2 : 1;
  const width = 1200 * s;
  const height = 750 * s;
  const fonts = await loadSeoulNamsanFonts();
  const qrSize = 112 * s;
  const qrDataUrl = generateQrSvgDataUrl(showroomUrl, {
    fg: TOKENS.fg,
    bg: TOKENS.surface,
    size: qrSize,
  });

  const hasFilter = Boolean(guide.filter);
  const hasEspresso = Boolean(guide.espresso);
  const twoCols = hasFilter && hasEspresso;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: TOKENS.surface,
        color: TOKENS.fg,
        fontFamily: "SeoulNamsan",
        padding: `${48 * s}px ${56 * s}px`,
        border: `${2 * s}px solid ${TOKENS.borderStrong}`,
      }}
    >
      {/* 상단 라벨 + 원두명 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderBottom: `${2 * s}px solid ${TOKENS.fg}`,
          paddingBottom: 24 * s,
        }}
      >
        <div
          style={{
            fontSize: 16 * s,
            fontWeight: 700,
            letterSpacing: `${3 * s}px`,
            color: TOKENS.fgMuted,
          }}
        >
          BREW GUIDE
        </div>
        <div
          style={{
            marginTop: 10 * s,
            fontSize: 42 * s,
            fontWeight: 700,
            color: TOKENS.fgStrong,
          }}
        >
          {guide.title}
        </div>
      </div>

      {/* 본문 1단/2단 레시피 */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 48 * s,
          flex: 1,
          paddingTop: 28 * s,
          paddingBottom: 28 * s,
        }}
      >
        {guide.filter ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              width: twoCols ? "50%" : "100%",
            }}
          >
            <div
              style={{
                fontSize: 18 * s,
                fontWeight: 700,
                letterSpacing: `${2 * s}px`,
                color: TOKENS.fgStrong,
                marginBottom: 8 * s,
              }}
            >
              FILTER
            </div>
            <RecipeRow
              label="원두량"
              value={guide.filter.doseG}
              unit="g"
              s={s}
            />
            <RecipeRow label="분쇄도" value={guide.filter.grind} s={s} />
            <RecipeRow
              label="물 온도"
              value={guide.filter.waterTempC}
              unit="°C"
              s={s}
            />
            <RecipeRow
              label="추출량"
              value={guide.filter.yieldG}
              unit="g"
              s={s}
            />
            <RecipeRow
              label="추출 시간"
              value={guide.filter.timeSec}
              unit="초"
              s={s}
            />
          </div>
        ) : null}

        {guide.espresso ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              width: twoCols ? "50%" : "100%",
            }}
          >
            <div
              style={{
                fontSize: 18 * s,
                fontWeight: 700,
                letterSpacing: `${2 * s}px`,
                color: TOKENS.fgStrong,
                marginBottom: 8 * s,
              }}
            >
              ESPRESSO
            </div>
            <RecipeRow
              label="원두량"
              value={guide.espresso.doseG}
              unit="g"
              s={s}
            />
            <RecipeRow
              label="바스켓"
              value={guide.espresso.basketG}
              unit="g"
              s={s}
            />
            <RecipeRow
              label="물 온도"
              value={guide.espresso.waterTempC}
              unit="°C"
              s={s}
            />
            <RecipeRow
              label="추출량"
              value={guide.espresso.yieldG}
              unit="g"
              s={s}
            />
            <RecipeRow
              label="추출 시간"
              value={guide.espresso.timeSec}
              unit="초"
              s={s}
            />
          </div>
        ) : null}
      </div>

      {/* 하단 고정 띠 */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: TOKENS.surfaceAlt,
          borderTop: `${1 * s}px solid ${TOKENS.borderStrong}`,
          padding: `${18 * s}px ${24 * s}px`,
          borderRadius: 12 * s,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 22 * s,
              fontWeight: 700,
              color: TOKENS.fgStrong,
            }}
          >
            {guide.storeName || "매장"}
          </div>
          <div
            style={{
              marginTop: 6 * s,
              fontSize: 18 * s,
              fontWeight: 500,
              color: TOKENS.fgMuted,
            }}
          >
            {`${guide.authorName || "바리스타"}${guide.authorHandle ? ` (@${guide.authorHandle})` : ""}`}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          width={qrSize}
          height={qrSize}
          alt="쇼룸 QR"
          style={{ width: qrSize, height: qrSize }}
        />
      </div>
    </div>,
    {
      width,
      height,
      fonts: [
        {
          name: "SeoulNamsan",
          data: fonts.medium,
          weight: 500,
          style: "normal",
        },
        {
          name: "SeoulNamsan",
          data: fonts.bold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
