import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppPopupDto } from "@blending/admin-contracts";
import type { AppPopupQueryRepository } from "@/application/admin/appPopupUseCases";
import { NextRequest } from "next/server";
import { handleGetAppPopups } from "@/infrastructure/server/appPopupRoute";

const publicPopup: AppPopupDto = {
  id: "popup-1",
  imageUrl: "https://cdn.example.com/popup.webp",
  imageAlt: "여름 프로모션 안내",
  href: "/partner/promotions",
};

const repository: AppPopupQueryRepository = {
  listActive: async () => [publicPopup],
};

const request = (placement: string) =>
  new NextRequest(`http://localhost/api/popups?placement=${placement}`);

const signedInDeps = {
  getUser: async () => ({ id: "member-1" }) as never,
  repository,
  now: () => "2026-08-20T00:00:00.000Z",
};

describe("GET /api/popups", () => {
  it("requires a member session", async () => {
    const response = await handleGetAppPopups(request("home"), {
      getUser: async () => null,
      repository,
      now: () => "2026-08-20T00:00:00.000Z",
    });
    assert.equal(response.status, 401);
  });

  it("rejects unknown placements", async () => {
    const response = await handleGetAppPopups(request("login"), signedInDeps);
    assert.equal(response.status, 400);
  });

  it("returns only the public DTO from the repository", async () => {
    const response = await handleGetAppPopups(request("home"), signedInDeps);
    assert.deepEqual(await response.json(), [publicPopup]);
  });

  it("returns a safe error when the repository fails", async () => {
    const response = await handleGetAppPopups(request("home"), {
      ...signedInDeps,
      repository: {
        listActive: async () => {
          throw new Error("mongodb://secret-host/app_popups");
        },
      },
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      message: "팝업을 불러오지 못했습니다.",
    });
  });
});
