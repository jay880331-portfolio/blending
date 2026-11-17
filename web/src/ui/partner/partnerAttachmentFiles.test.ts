import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterPartnerAttachmentFiles,
  normalizePartnerAttachmentFile,
  partnerAttachmentMime,
} from "./partnerAttachmentFiles";

function file(name: string, type: string, size = 8) {
  return new File([new Uint8Array(size)], name, { type });
}

test("빈 MIME은 확장자로 jpeg/png/pdf를 복구한다", () => {
  assert.equal(partnerAttachmentMime(file("a.jpg", "")), "image/jpeg");
  assert.equal(partnerAttachmentMime(file("a.PNG", "")), "image/png");
  assert.equal(partnerAttachmentMime(file("a.pdf", "")), "application/pdf");
});

test("image/jpg·pjpeg는 image/jpeg로 정규화한다", () => {
  const normalized = normalizePartnerAttachmentFile(file("a.jpg", "image/jpg"));
  assert.equal(normalized.type, "image/jpeg");
});

test("지원하지 않는 타입은 걸러지고 토스트를 낸다", () => {
  const messages: string[] = [];
  const kept = filterPartnerAttachmentFiles(
    [file("a.webp", "image/webp"), file("ok.png", "image/png")],
    (message) => messages.push(message),
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.name, "ok.png");
  assert.equal(messages[0], "이미지 또는 PDF 파일만 첨부할 수 있습니다.");
});
