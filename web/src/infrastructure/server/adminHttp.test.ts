import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminError, adminJson } from "./adminHttp";

describe("adminError", () => {
  it("returns a stable request id without leaking causes", async () => {
    const response = adminError(
      "INVALID_INPUT",
      "입력값을 확인해주세요.",
      400,
      "req-1",
    );

    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), {
      code: "INVALID_INPUT",
      message: "입력값을 확인해주세요.",
      requestId: "req-1",
    });
  });
});

describe("adminJson", () => {
  it("returns JSON responses that cannot be cached", async () => {
    const response = adminJson({ ok: true }, 201);

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { ok: true });
  });
});
