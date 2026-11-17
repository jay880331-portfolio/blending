import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAdminContentListQuery } from "./adminContentListQuery";

describe("parseAdminContentListQuery", () => {
  it("parses allowlisted content filters", () => {
    assert.deepEqual(
      parseAdminContentListQuery(
        new URLSearchParams(
          "kind=community_review&state=hidden&authorId=user-1&sort=likes&page=2&pageSize=50",
        ),
      ),
      {
        kind: "community_review",
        state: "hidden",
        authorId: "user-1",
        sort: "likes",
        page: 2,
        pageSize: 50,
        direction: "desc",
        q: undefined,
        status: undefined,
        from: undefined,
        to: undefined,
      },
    );
  });

  it("rejects unknown kinds and query keys", () => {
    assert.throws(
      () => parseAdminContentListQuery(new URLSearchParams("kind=users")),
      /종류/,
    );
    assert.throws(
      () =>
        parseAdminContentListQuery(
          new URLSearchParams("kind=community_review&collection=users"),
        ),
      /지원하지/,
    );
  });
});
