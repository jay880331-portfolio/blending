import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  auditLogDetailHref,
  parseUserRelatedQuery,
  updateUserRelatedQuery,
  userAuditLogsHref,
} from "./userRelatedQuery";

describe("user related query", () => {
  it("restores a supported tab and positive page from shared search params", () => {
    assert.deepEqual(parseUserRelatedQuery("tab=messages&page=3"), {
      tab: "messages",
      page: 3,
    });
    assert.deepEqual(parseUserRelatedQuery("tab=unknown&page=-1"), {
      tab: "profile",
      page: 1,
    });
    assert.deepEqual(parseUserRelatedQuery("tab=badges"), {
      tab: "badges",
      page: 1,
    });
  });

  it("preserves unrelated params while updating tab and page", () => {
    assert.equal(
      updateUserRelatedQuery("source=report&tab=activity&page=4", {
        tab: "favorites",
        page: 2,
      }),
      "source=report&tab=favorites&page=2",
    );
    assert.equal(
      updateUserRelatedQuery("source=report&tab=activity&page=4", {
        tab: "profile",
        page: 1,
      }),
      "source=report",
    );
  });
});

describe("user audit links", () => {
  it("links a user to the audit list resource filter", () => {
    assert.equal(
      userAuditLogsHref("user / 1"),
      "/audit-logs?resourceId=user+%2F+1",
    );
  });

  it("links a known audit id directly to its detail page", () => {
    assert.equal(
      auditLogDetailHref("audit / 1"),
      "/audit-logs/audit%20%2F%201",
    );
  });
});
