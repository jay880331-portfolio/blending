import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createPromotionPdfPreviewRoute } from "./promotionPdfPreviewRoute";

const allowedUrl =
  "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/partner/promotions/spec.pdf";

function previewRequest(url: string) {
  return new NextRequest(
    `http://localhost/api/partner/promotions/preview?url=${encodeURIComponent(url)}`,
  );
}

test("로그인한 사용자만 허용된 홍보 PDF를 inline으로 준다", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const route = createPromotionPdfPreviewRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    fetchPdf: async (url) => {
      assert.equal(url, allowedUrl);
      return { ok: true, contentType: "application/pdf", body: pdf };
    },
  });
  const response = await route(previewRequest(allowedUrl));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(
    response.headers.get("content-disposition"),
    "inline; filename=\"promotion.pdf\"; filename*=UTF-8''promotion.pdf",
  );
});

test("로그인하지 않으면 미리보기를 주지 않는다", async () => {
  const route = createPromotionPdfPreviewRoute({
    getCurrentUser: async () => null,
    fetchPdf: async () => {
      throw new Error("should not fetch");
    },
  });
  assert.equal((await route(previewRequest(allowedUrl))).status, 401);
});

test("허용되지 않은 URL은 열지 않는다", async () => {
  const route = createPromotionPdfPreviewRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    fetchPdf: async () => {
      throw new Error("should not fetch");
    },
  });
  assert.equal(
    (await route(previewRequest("https://example.com/secret.pdf"))).status,
    400,
  );
});

test("disposition=attachment이면 첨부 파일명으로 내려준다", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const route = createPromotionPdfPreviewRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    fetchPdf: async () => ({
      ok: true,
      contentType: "application/pdf",
      body: pdf,
    }),
  });
  const response = await route(
    new NextRequest(
      `http://localhost/api/partner/promotions/preview?url=${encodeURIComponent(allowedUrl)}&disposition=attachment&filename=${encodeURIComponent("안내서.pdf")}`,
    ),
  );
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-disposition") ?? "",
    /^attachment;/,
  );
  assert.match(
    response.headers.get("content-disposition") ?? "",
    /filename\*=UTF-8''%EC%95%88%EB%82%B4%EC%84%9C\.pdf/,
  );
});

test("주입된 R2_PUBLIC_BASE_URL 호스트의 PDF도 허용한다", async () => {
  const customUrl =
    "https://files.blending.example/partner/promotions/custom.pdf";
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const route = createPromotionPdfPreviewRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    fetchPdf: async () => ({
      ok: true,
      contentType: "application/pdf",
      body: pdf,
    }),
    getR2PublicBaseUrl: () => "https://files.blending.example",
  });
  const response = await route(previewRequest(customUrl));
  assert.equal(response.status, 200);
});
