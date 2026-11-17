import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  SearchIndexRunDto,
  SearchIndexRunTrigger,
} from "@blending/admin-contracts";
import {
  inspectSearchIndex,
  reconcileSearchIndex,
  SearchIndexBusyError,
  type SearchIndexOperationsRepository,
} from "./searchIndexUseCases";

function fakeRepository(): SearchIndexOperationsRepository & {
  snapshots: string[][];
} {
  let running = false;
  let latest: SearchIndexRunDto | null = null;
  const snapshots: string[][] = [];
  return {
    snapshots,
    async inspect() {
      return [
        {
          type: "community_review",
          sourceCount: 2,
          indexedCount: 2,
          missingCount: 1,
          orphanCount: 1,
        },
      ];
    },
    async latestRun() {
      return latest;
    },
    async start(trigger: SearchIndexRunTrigger, _actorId, now) {
      if (running) return null;
      running = true;
      latest = {
        id: "run-1",
        trigger,
        status: "running",
        indexedCount: 0,
        deletedCount: 0,
        durationMs: 0,
        startedAt: now.toISOString(),
        completedAt: null,
      };
      return latest;
    },
    async reconcile() {
      const ids = ["community_review:1", "community_review:2"];
      snapshots.push(ids);
      return { indexedCount: 2, deletedCount: 1 };
    },
    async finish(_id, completion) {
      running = false;
      latest = { ...latest!, ...completion };
      return latest;
    },
  };
}

describe("searchIndexUseCases", () => {
  it("reports missing and orphan search documents by source type", async () => {
    const health = await inspectSearchIndex(fakeRepository());
    assert.deepEqual(health.byType[0], {
      type: "community_review",
      sourceCount: 2,
      indexedCount: 2,
      missingCount: 1,
      orphanCount: 1,
    });
  });

  it("produces the same final index on repeated reconcile", async () => {
    const repository = fakeRepository();
    await reconcileSearchIndex("admin", "admin-1", repository);
    await reconcileSearchIndex("admin", "admin-1", repository);
    assert.deepEqual(repository.snapshots[1], repository.snapshots[0]);
  });

  it("rejects a concurrent reconcile", async () => {
    const repository = fakeRepository();
    await repository.start("cron", undefined, new Date());
    await assert.rejects(
      reconcileSearchIndex("admin", "admin-1", repository),
      SearchIndexBusyError,
    );
  });

  it("stores only a stable error code when reconcile fails", async () => {
    const repository = fakeRepository();
    repository.reconcile = async () => {
      throw new Error("mongodb://secret-host/raw document");
    };
    await assert.rejects(
      reconcileSearchIndex("cron", undefined, repository),
      /secret-host/,
    );
    assert.equal((await repository.latestRun())?.errorCode, "RECONCILE_FAILED");
    assert.equal(
      JSON.stringify(await repository.latestRun()).includes("secret"),
      false,
    );
  });
});
