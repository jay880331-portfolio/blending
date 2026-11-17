import assert from "node:assert/strict";
import test from "node:test";
import {
  countMigrationWrites,
  guideContentSeeds,
  planGuideContentMigration,
} from "./migrate-guide-content";

test("plans inserts, updates, and unchanged seeds by stable id", () => {
  const notice = guideContentSeeds.notices[0];
  const faq = guideContentSeeds.faqs[0];
  const plan = planGuideContentMigration({
    notices: [{ ...notice }],
    faqs: [{ ...faq, answer: "old answer" }],
  });

  assert.deepEqual(plan.notices, { insert: 4, update: 0, unchanged: 1 });
  assert.deepEqual(plan.faqs, { insert: 8, update: 1, unchanged: 0 });
});

test("re-running against the seeded values has no writes", () => {
  const plan = planGuideContentMigration(guideContentSeeds);

  assert.deepEqual(plan.notices, { insert: 0, update: 0, unchanged: 5 });
  assert.deepEqual(plan.faqs, { insert: 0, update: 0, unchanged: 9 });
  assert.deepEqual(countMigrationWrites(plan), {
    matchedCount: 0,
    modifiedCount: 0,
    upsertedCount: 0,
  });
});

test("seeds FAQs in category and display order", () => {
  assert.deepEqual(
    guideContentSeeds.faqs.map(({ category, sortOrder }) => ({
      category,
      sortOrder,
    })),
    [
      { category: "guide", sortOrder: 0 },
      { category: "guide", sortOrder: 1 },
      { category: "guide", sortOrder: 2 },
      { category: "guide", sortOrder: 3 },
      { category: "guide", sortOrder: 4 },
      { category: "guide", sortOrder: 5 },
      { category: "account", sortOrder: 6 },
      { category: "account", sortOrder: 7 },
      { category: "account", sortOrder: 8 },
    ],
  );
});
