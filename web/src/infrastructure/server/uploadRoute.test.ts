import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { createUploadRoute, privateUploadKind } from "./uploadRoute";

test("maps only private aliases and uses the authenticated user prefix", async () => {
  const folders: string[] = [];
  const route = createUploadRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    uploadImageFiles: async (_files, folder) => (
      folders.push(folder ?? ""),
      []
    ),
    uploadProfileDocuments: async () => [],
    uploadPartnerAttachments: async () => [],
  });
  const formData = new FormData();
  formData.set("folder", "members/avatars");
  formData.set(
    "files",
    new File(["image"], "image.png", { type: "image/png" }),
  );
  assert.equal(
    (
      await route(
        new NextRequest("http://localhost/api/uploads", {
          method: "POST",
          body: formData,
        }),
      )
    ).status,
    200,
  );
  assert.equal(privateUploadKind("community/events"), null);
  assert.deepEqual(folders, ["members/user-1/private/profile"]);
});

test("replaces unknown upload failures without logging sensitive details", async () => {
  const secret = "bucket/private/key";
  const route = createUploadRoute({
    getCurrentUser: async () => ({ id: "user-1" }),
    uploadImageFiles: async () => {
      throw new Error(secret);
    },
    uploadProfileDocuments: async () => [],
    uploadPartnerAttachments: async () => [],
  });
  const formData = new FormData();
  formData.set(
    "files",
    new File(["image"], "image.png", { type: "image/png" }),
  );
  const response = await route(
    new NextRequest("http://localhost/api/uploads", {
      method: "POST",
      body: formData,
    }),
  );
  assert.deepEqual(await response.json(), {
    message: "파일 업로드에 실패했습니다.",
  });
});
