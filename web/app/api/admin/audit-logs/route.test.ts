import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminAuditRepository } from "@/application/admin/adminUnitOfWork";
import { NextRequest } from "next/server";
import { getAuditLogsResponse } from "./route";

describe("admin audit log list route", () => {
  it("does not expose repository errors", async () => {
    const repository = {
      async list() {
        throw new Error("mongodb://secret-host/raw-document");
      },
    } as unknown as AdminAuditRepository;
    const response = await getAuditLogsResponse(
      new NextRequest("http://localhost/api/admin/audit-logs"),
      repository,
    );

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.code, "INTERNAL_ERROR");
    assert.equal(body.message, "감사 로그를 조회하지 못했습니다.");
    assert.equal(typeof body.requestId, "string");
    assert.equal(JSON.stringify(body).includes("secret-host"), false);
  });

  it("keeps invalid filters as a safe 400 response", async () => {
    const response = await getAuditLogsResponse(
      new NextRequest("http://localhost/api/admin/audit-logs?action=secret"),
      {} as AdminAuditRepository,
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_INPUT");
    assert.equal(JSON.stringify(body).includes("secret-host"), false);
  });
});
