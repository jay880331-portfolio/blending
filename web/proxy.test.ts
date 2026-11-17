import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("admin CORS preflight", () => {
  it("allows every admin mutation method, including PUT", async () => {
    const response = await proxy(
      new NextRequest("http://localhost/api/admin/popups/popup-1", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:3001" },
      }),
    );

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Methods"),
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
  });
});
