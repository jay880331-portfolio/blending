import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AdminDashboardDto,
  DashboardRange,
} from "@blending/admin-contracts";
import {
  getAdminDashboard,
  parseDashboardRange,
  type DashboardRepository,
} from "./dashboardUseCase";

describe("dashboard range", () => {
  it("accepts supported", () => {
    assert.equal(parseDashboardRange("7d"), "7d");
    assert.equal(parseDashboardRange(null), "30d");
  });

  it("rejects invalid", () => {
    assert.throws(() => parseDashboardRange("365d"), /조회 기간/);
  });
});

describe("getAdminDashboard with injected repository", () => {
  const dummyDto: AdminDashboardDto = {
    generatedAt: "2026-09-05T00:00:00.000Z",
    range: "30d",
    summary: {
      totalUsers: 100,
      newUsers: 10,
      recentlyActiveUsers: 50,
      activeContent: 200,
      newContent: 20,
      likes: 300,
      openReports: 2,
    },
    daily: [],
    usersByRole: [{ role: "user", count: 100 }],
    contentByType: [{ type: "review", count: 200 }],
  };

  it("forwards range, now, and timeZone to repository and returns matching DTO", async () => {
    let capturedInput:
      | { range: DashboardRange; now: Date; timeZone: string }
      | undefined;
    const fakeRepo: DashboardRepository = {
      async getDashboard(input) {
        capturedInput = input;
        return { ...dummyDto, range: input.range };
      },
    };

    const fixedNow = new Date("2026-09-05T12:34:56.000Z");
    const result = await getAdminDashboard(fakeRepo, "7d", fixedNow);

    assert.deepEqual(capturedInput, {
      range: "7d",
      now: fixedNow,
      timeZone: "Asia/Seoul",
    });
    assert.equal(result.range, "7d");
    assert.equal(result.summary.totalUsers, 100);
  });

  it("uses default now parameter if not provided", async () => {
    let capturedNow: Date | undefined;
    const fakeRepo: DashboardRepository = {
      async getDashboard(input) {
        capturedNow = input.now;
        return dummyDto;
      },
    };

    const before = Date.now();
    await getAdminDashboard(fakeRepo, "30d");
    const after = Date.now();

    assert.ok(capturedNow instanceof Date);
    assert.ok(
      capturedNow.getTime() >= before && capturedNow.getTime() <= after,
    );
  });

  it("propagates repository rejection to the caller", async () => {
    const fakeRepo: DashboardRepository = {
      async getDashboard() {
        throw new Error("Repository failure");
      },
    };

    await assert.rejects(
      () => getAdminDashboard(fakeRepo, "90d"),
      /Repository failure/,
    );
  });
});
