import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commentParentKind,
  contentCommentsQuery,
  contentAuditLogsHref,
  shouldRenderContentReactionSection,
} from "./contentKind";

describe("shouldRenderContentReactionSection", () => {
  it("excludes content kinds without reaction storage", () => {
    assert.equal(shouldRenderContentReactionSection("community_event"), false);
    assert.equal(shouldRenderContentReactionSection("partner_banner"), false);
    assert.equal(shouldRenderContentReactionSection("community_review"), true);
  });
});

describe("content operations", () => {
  it("maps only comment-backed content kinds", () => {
    assert.equal(commentParentKind("community_b_talk"), "b-talk");
    assert.equal(commentParentKind("community_qa"), "qa");
    assert.equal(commentParentKind("community_event"), null);
  });

  it("links content to its filtered audit logs", () => {
    assert.equal(
      contentAuditLogsHref("community_qa", "qa/1"),
      "/audit-logs?resourceType=community_qa&resourceId=qa%2F1",
    );
  });

  it("builds a comment query for the current content", () => {
    assert.equal(
      contentCommentsQuery("b-talk", "post/1", 2),
      "parentKind=b-talk&parentId=post%2F1&page=2",
    );
  });
});
