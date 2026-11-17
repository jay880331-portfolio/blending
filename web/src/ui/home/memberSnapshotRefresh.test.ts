import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldForceRefreshMemberSnapshot } from "./memberSnapshotRefresh";

describe("shouldForceRefreshMemberSnapshot", () => {
  it("refreshes when entering the mypage interests screen", () => {
    assert.equal(
      shouldForceRefreshMemberSnapshot("mypage", ["interests"]),
      true,
    );
  });

  it("refreshes when entering the mypage posts and comments screen", () => {
    assert.equal(
      shouldForceRefreshMemberSnapshot("mypage", ["my-posts"]),
      true,
    );
  });

  it("does not force refresh ordinary home screens", () => {
    assert.equal(shouldForceRefreshMemberSnapshot("home", []), false);
  });
});
