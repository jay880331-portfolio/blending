import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedPartnerPromotionAttachmentUrl,
  partnerPromotionPdfDownloadPath,
} from "./promotionAttachmentUrl";

test("홍보 첨부는 R2 HTTPS 파트너 경로만 허용한다 (기본 및 주입된 호스트)", () => {
  const config = { r2PublicBaseUrl: "https://files.blending.example" };

  assert.equal(
    isAllowedPartnerPromotionAttachmentUrl(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/partner/promotions/spec.pdf",
    ),
    true,
  );
  assert.equal(
    isAllowedPartnerPromotionAttachmentUrl(
      "https://files.blending.example/partner/promotions/spec.pdf",
      config,
    ),
    true,
  );
  assert.equal(
    isAllowedPartnerPromotionAttachmentUrl(
      "https://example.com/partner/promotions/spec.pdf",
      config,
    ),
    false,
  );
  assert.equal(
    isAllowedPartnerPromotionAttachmentUrl(
      "http://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/partner/promotions/spec.pdf",
      config,
    ),
    false,
  );
  assert.equal(
    isAllowedPartnerPromotionAttachmentUrl(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/spec.pdf",
      config,
    ),
    false,
  );
  assert.equal(
    partnerPromotionPdfDownloadPath(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/partner/promotions/spec.pdf",
      "안내.pdf",
    ),
    "/api/partner/promotions/preview?url=https%3A%2F%2Fpub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev%2Fpartner%2Fpromotions%2Fspec.pdf&disposition=attachment&filename=%EC%95%88%EB%82%B4.pdf",
  );
});
