import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("event poster image", () => {
  it("loads the original poster instead of the image optimizer", () => {
    const source = readFileSync(
      new URL("./CommunityApp.tsx", import.meta.url),
      "utf8",
    );
    const detail = source.slice(
      source.indexOf("function EventDetailScreen"),
      source.indexOf("function EventRequestScreen"),
    );

    assert.match(detail, /unoptimized/);
    assert.doesNotMatch(detail, /src=\{event\.posterUrl\}[\s\S]{0,240}<Image/);
  });
});
