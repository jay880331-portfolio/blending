import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteOwnedUploadUrls,
  deletePrivateMemberUploadPrefix,
  privateMemberUploadFolder,
  r2ObjectKeysFromPublicUrls,
} from "./r2";

test("공개 R2 URL만 중복 없는 객체 키로 변환한다", () => {
  assert.deepEqual(
    r2ObjectKeysFromPublicUrls(
      [
        "https://cdn.blending.test/uploads/a.jpg",
        "https://cdn.blending.test/uploads/a.jpg",
        "https://cdn.blending.test/certificates/b.pdf?download=1",
        "https://external.test/uploads/c.jpg",
        "not-a-url",
      ],
      "https://cdn.blending.test",
    ),
    ["uploads/a.jpg", "certificates/b.pdf"],
  );
});

test("경로가 있는 공개 R2 기준 URL의 정확한 접두사만 허용한다", () => {
  assert.deepEqual(
    r2ObjectKeysFromPublicUrls(
      [
        "https://cdn.test/blending/uploads/a.jpg",
        "https://cdn.test/other/a.jpg",
      ],
      "https://cdn.test/blending",
    ),
    ["uploads/a.jpg"],
  );
});

test("R2 부분 삭제 오류가 나면 다음 1,000개 묶음을 삭제하지 않는다", async () => {
  let calls = 0;
  const urls = Array.from(
    { length: 1_001 },
    (_, index) => `https://cdn.blending.test/uploads/${index}.jpg`,
  );

  await assert.rejects(
    () =>
      deleteOwnedUploadUrls(urls, {
        bucket: "test-bucket",
        publicBaseUrl: "https://cdn.blending.test",
        send: async () => {
          calls += 1;
          return { Errors: [{}] };
        },
      }),
    /R2 object deletion failed/,
  );

  assert.equal(calls, 1);
});

test("개인 회원 업로드 폴더는 서버 사용자 ID 아래로 고정한다", () => {
  assert.equal(
    privateMemberUploadFolder("user-1", "profile"),
    "members/user-1/private/profile",
  );
  assert.equal(
    privateMemberUploadFolder("user-1", "certificates"),
    "members/user-1/private/certificates",
  );
  assert.equal(
    privateMemberUploadFolder("user-1", "portfolio"),
    "members/user-1/private/portfolio",
  );
  assert.throws(() => privateMemberUploadFolder("../other-user", "profile"));
  for (const userId of [
    "",
    "user id",
    "user:id",
    "user%2Fid",
    "user/id",
    "user\\id",
  ])
    assert.throws(() => privateMemberUploadFolder(userId, "profile"));
});

test("개인 회원 업로드 삭제는 페이지를 끝까지 따라가고 정확한 접두사만 1,000개씩 삭제한다", async () => {
  const firstPage = Array.from({ length: 1_000 }, (_, index) => ({
    Key: `members/user-1/private/profile/${index}.jpg`,
  }));
  const continuationTokens: Array<string | undefined> = [];
  const deletedKeys: string[][] = [];

  const count = await deletePrivateMemberUploadPrefix("user-1", {
    bucket: "test-bucket",
    list: async (command) => {
      continuationTokens.push(command.input.ContinuationToken);
      return continuationTokens.length === 1
        ? {
            Contents: [
              ...firstPage,
              { Key: "members/user-1/privateish/keep.jpg" },
            ],
            IsTruncated: true,
            NextContinuationToken: "page-2",
          }
        : {
            Contents: [
              { Key: "members/user-1/private/portfolio/last.jpg" },
              { Key: "members/user-2/private/profile/keep.jpg" },
            ],
          };
    },
    send: async (command) => {
      deletedKeys.push(
        (command.input.Delete?.Objects ?? []).flatMap((object) =>
          object.Key ? [object.Key] : [],
        ),
      );
      return {};
    },
  });

  assert.equal(count, 1_001);
  assert.deepEqual(continuationTokens, [undefined, "page-2"]);
  assert.equal(deletedKeys.length, 2);
  assert.equal(deletedKeys[0]?.length, 1_000);
  assert.deepEqual(deletedKeys[1], [
    "members/user-1/private/portfolio/last.jpg",
  ]);
});

test("개인 회원 업로드 삭제는 부분 오류 뒤의 묶음을 실행하지 않는다", async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      deletePrivateMemberUploadPrefix("user-1", {
        bucket: "test-bucket",
        list: async () => ({
          Contents: Array.from({ length: 1_001 }, (_, index) => ({
            Key: `members/user-1/private/profile/${index}.jpg`,
          })),
        }),
        send: async () => {
          calls += 1;
          return { Errors: [{}] };
        },
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "R2 object deletion failed.",
  );

  assert.equal(calls, 1);
});

test("개인 회원 업로드 삭제는 빈 접두사에서 0을 반환한다", async () => {
  let sends = 0;
  const count = await deletePrivateMemberUploadPrefix("user-1", {
    bucket: "test-bucket",
    list: async () => ({ Contents: [] }),
    send: async () => {
      sends += 1;
      return {};
    },
  });

  assert.equal(count, 0);
  assert.equal(sends, 0);
});

test("개인 회원 업로드 삭제는 다음 페이지 토큰이 없으면 목록 오류로 중단한다", async () => {
  let sends = 0;

  await assert.rejects(
    () =>
      deletePrivateMemberUploadPrefix("user-1", {
        bucket: "test-bucket",
        list: async () => ({ IsTruncated: true }),
        send: async () => {
          sends += 1;
          return {};
        },
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "R2 object listing failed.",
  );

  assert.equal(sends, 0);
});

test("개인 회원 업로드 삭제는 반복된 다음 페이지 토큰에서 목록 오류로 중단한다", async () => {
  let calls = 0;

  await assert.rejects(
    () =>
      deletePrivateMemberUploadPrefix("user-1", {
        bucket: "test-bucket",
        list: async () => {
          calls += 1;
          return { IsTruncated: true, NextContinuationToken: "same-token" };
        },
        send: async () => ({}),
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "R2 object listing failed.",
  );

  assert.equal(calls, 2);
});
