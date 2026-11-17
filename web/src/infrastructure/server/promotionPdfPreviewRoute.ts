import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAllowedPartnerPromotionAttachmentUrl } from "@/domain/partner/promotionAttachmentUrl";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

export type FetchedPdf = {
  ok: boolean;
  contentType: string | null;
  body: Uint8Array;
};

export type PromotionPdfPreviewDependencies = {
  getCurrentUser(request: NextRequest): Promise<{ id: string } | null>;
  fetchPdf(url: string): Promise<FetchedPdf>;
  getR2PublicBaseUrl?(): string | undefined;
};

function startsWithPdfMagic(body: Uint8Array) {
  return (
    body.length >= PDF_MAGIC.length &&
    PDF_MAGIC.every((value, index) => body[index] === value)
  );
}

function sanitizeDownloadFilename(value: string) {
  const trimmed = value.trim() || "promotion.pdf";
  const base = trimmed.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 180);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

function contentDispositionHeader(
  disposition: "inline" | "attachment",
  filename: string,
) {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_") || "promotion.pdf";
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function defaultFetchPdf(url: string): Promise<FetchedPdf> {
  const response = await fetch(url, {
    headers: { "User-Agent": "blending-promotion-pdf-preview" },
    redirect: "error",
  });
  return {
    ok: response.ok,
    contentType: response.headers.get("content-type"),
    body: new Uint8Array(await response.arrayBuffer()),
  };
}

const productionDependencies: PromotionPdfPreviewDependencies = {
  getCurrentUser,
  fetchPdf: defaultFetchPdf,
  getR2PublicBaseUrl: () => process.env.R2_PUBLIC_BASE_URL,
};

export function createPromotionPdfPreviewRoute(
  dependencies: PromotionPdfPreviewDependencies = productionDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const user = await dependencies.getCurrentUser(request);
    if (!user) return jsonError("로그인이 필요합니다.", 401);

    const sourceUrl = request.nextUrl.searchParams.get("url") ?? "";
    const r2PublicBaseUrl =
      dependencies.getR2PublicBaseUrl?.() ?? process.env.R2_PUBLIC_BASE_URL;
    if (
      !isAllowedPartnerPromotionAttachmentUrl(sourceUrl, {
        r2PublicBaseUrl,
      })
    )
      return jsonError("미리볼 수 없는 파일입니다.", 400);

    const wantsAttachment =
      request.nextUrl.searchParams.get("disposition") === "attachment";
    const filename = sanitizeDownloadFilename(
      request.nextUrl.searchParams.get("filename") ?? "promotion.pdf",
    );

    try {
      const fetched = await dependencies.fetchPdf(sourceUrl);
      const looksPdf =
        (fetched.contentType ?? "").includes("application/pdf") ||
        startsWithPdfMagic(fetched.body);
      if (!fetched.ok || !looksPdf)
        return jsonError("PDF를 불러오지 못했습니다.", fetched.ok ? 415 : 502);

      return new NextResponse(Buffer.from(fetched.body), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDispositionHeader(
            wantsAttachment ? "attachment" : "inline",
            wantsAttachment ? filename : "promotion.pdf",
          ),
          "Cache-Control": "private, max-age=120",
        },
      });
    } catch {
      return jsonError("PDF를 불러오지 못했습니다.", 502);
    }
  };
}

export const promotionPdfPreviewRoute = createPromotionPdfPreviewRoute();
