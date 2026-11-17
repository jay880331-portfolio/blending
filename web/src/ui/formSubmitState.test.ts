import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const globalsSource = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const communitySource = readFileSync(
  new URL("./community/CommunityApp.tsx", import.meta.url),
  "utf8",
);
const dailyNoteSource = readFileSync(
  new URL("./community/DailyNoteApp.tsx", import.meta.url),
  "utf8",
);
const partnerSource = readFileSync(
  new URL("./partner/PartnerApp.tsx", import.meta.url),
  "utf8",
);
const homeSource = readFileSync(
  new URL("./home/HomeApp.tsx", import.meta.url),
  "utf8",
);

test("폼 제출 CTA는 필수값과 제출 상태에서만 활성화된다", () => {
  assert.match(
    globalsSource,
    /\.ds-btn-primary:disabled,[\s\S]*background: var\(--accent-soft\);[\s\S]*color: var\(--accent\);/,
  );

  assert.equal(
    communitySource.match(
      /disabled=\{!title\.trim\(\) \|\| !body\.trim\(\) \|\| submitting\}/g,
    )?.length,
    4,
  );
  assert.match(
    communitySource,
    /disabled=\{!title\.trim\(\) \|\| !journal\.trim\(\) \|\| submitting\}/,
  );

  assert.match(
    partnerSource,
    /const missingRequired = \[\s*attachedImages\.length === 0,\s*companyName\.trim\(\)\.length === 0,\s*productName\.trim\(\)\.length === 0,\s*!category,\s*promotionTitle\.trim\(\)\.length === 0,\s*\]\.filter\(Boolean\)\.length;\s*const canSubmit = missingRequired === 0;/,
  );
  assert.match(
    partnerSource,
    /const canSubmit =\s+brand\.trim\(\)\.length > 0 &&\s+modelName\.trim\(\)\.length > 0 &&\s+title\.trim\(\)\.length > 0 &&\s+body\.trim\(\)\.length >= 100 &&\s+Boolean\(category\);/,
  );
  assert.equal(
    partnerSource.match(/disabled=\{!canSubmit \|\| submitting\}/g)?.length,
    2,
  );

  assert.match(dailyNoteSource, /disabled=\{submitting \|\| !images\.length\}/);
  assert.match(
    homeSource,
    /disabled=\{!canSave \|\| saving\}\s+onClick=\{saveProfile\}/,
  );
  assert.match(homeSource, /saving \? "수정 중\.\.\." : "수정하기"/);
  assert.match(
    homeSource,
    /disabled=\{!canSubmit \|\| saving\}\s+onClick=\{submitPortfolio\}/,
  );
});
