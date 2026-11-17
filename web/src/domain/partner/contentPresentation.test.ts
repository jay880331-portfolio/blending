import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayPartnerTitle,
  normalizePartnerLineBreaks,
  partnerMultilineTextProps,
} from "./contentPresentation";

describe("partner content presentation", () => {
  it("uses the entered title before the first content line for promotions and reviews", () => {
    assert.equal(
      displayPartnerTitle("홍보 제목", "홍보 본문 첫 줄"),
      "홍보 제목",
    );
    assert.equal(
      displayPartnerTitle("리뷰 제목", "리뷰 본문 첫 줄"),
      "리뷰 제목",
    );
  });

  it("preserves LF and CRLF line breaks for promotion and review detail text", () => {
    assert.equal(
      normalizePartnerLineBreaks("홍보 첫 문단\r\n홍보 둘째 문단"),
      "홍보 첫 문단\n홍보 둘째 문단",
    );
    assert.equal(
      normalizePartnerLineBreaks("리뷰 첫 문단\n리뷰 둘째 문단"),
      "리뷰 첫 문단\n리뷰 둘째 문단",
    );
  });

  it("provides multiline rendering props for partner detail text", () => {
    assert.deepEqual(partnerMultilineTextProps("첫 문단\r\n둘째 문단"), {
      className: "whitespace-pre-line",
      children: "첫 문단\n둘째 문단",
    });
  });
});
