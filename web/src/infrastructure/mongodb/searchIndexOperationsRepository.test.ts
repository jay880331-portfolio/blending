import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateSearchIndexTypeHealth,
  createSearchIndexOperationsRepository,
  type SearchIndexRunStore,
} from "./searchIndexOperationsRepository";

describe("searchIndexOperationsRepository", () => {
  it("calculates missing and orphan counts from unique ids", () => {
    assert.deepEqual(
      calculateSearchIndexTypeHealth(
        "community_review",
        ["a", "b"],
        ["b", "c"],
      ),
      {
        type: "community_review",
        sourceCount: 2,
        indexedCount: 2,
        missingCount: 1,
        orphanCount: 1,
      },
    );
  });

  it("allows only one running lease", async () => {
    let running = false;
    const store: SearchIndexRunStore = {
      async expire() {},
      async insert(document) {
        if (running) return false;
        running = true;
        return Boolean(document.id);
      },
      async latest() {
        return null;
      },
      async finish() {
        throw new Error("not used");
      },
    };
    const repository = createSearchIndexOperationsRepository({
      store,
      inspect: async () => [],
      reconcile: async () => ({ indexedCount: 0, deletedCount: 0 }),
    });

    assert.ok(await repository.start("admin", "admin-1", new Date()));
    assert.equal(await repository.start("cron", undefined, new Date()), null);
  });
});
