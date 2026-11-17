import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAuthorizedCronRequest } from "./route";

describe("isAuthorizedCronRequest", () => {
  it("requires the CRON_SECRET bearer token", () => {
    process.env.CRON_SECRET = "secret";

    assert.equal(
      isAuthorizedCronRequest(
        new Request("https://example.com", {
          headers: { authorization: "Bearer secret" },
        }),
      ),
      true,
    );
    assert.equal(
      isAuthorizedCronRequest(new Request("https://example.com")),
      false,
    );
  });
});
