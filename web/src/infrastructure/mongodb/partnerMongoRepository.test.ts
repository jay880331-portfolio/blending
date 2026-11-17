import assert from "node:assert/strict";
import { it } from "node:test";
import { activePartnerBannerFilter } from "./partnerMongoRepository";

it("publishes only active scheduled banners while preserving legacy banners", () => {
  const now = "2026-07-01T00:00:00.000Z";
  const filter = activePartnerBannerFilter(now);
  assert.deepEqual(filter.$and[1], {
    $or: [
      { activeFrom: { $lte: now }, activeTo: { $gt: now } },
      { activeFrom: { $exists: false }, activeTo: { $exists: false } },
    ],
  });
});
