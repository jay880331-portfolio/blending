import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { validateDailyNoteCreateRequest } from "@/application/daily-note/dailyNoteCreateRequest";

test("Daily Note API는 로그인하지 않은 요청을 차단한다", async () => {
  const getResponse = await GET(
    new NextRequest("http://localhost/api/community/daily-notes"),
  );
  const postResponse = await POST(
    new NextRequest("http://localhost/api/community/daily-notes", {
      method: "POST",
      body: JSON.stringify({
        imageUrls: [
          "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg",
        ],
      }),
      headers: { "content-type": "application/json" },
    }),
  );

  assert.equal(getResponse.status, 401);
  assert.equal(
    (
      await GET(
        new NextRequest("http://localhost/api/community/daily-notes?picked=1"),
      )
    ).status,
    401,
  );
  assert.equal(postResponse.status, 401);
});

test("Daily Note 생성 API는 사진과 대표 기술값을 검증한다", () => {
  assert.match(
    validateDailyNoteCreateRequest({ imageUrls: [] }, "user-a") as string,
    /사진은 1장 이상/,
  );
  assert.match(
    validateDailyNoteCreateRequest(
      {
        imageUrls: [
          "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/user-a/note.jpg",
        ],
        technicals: {},
        featuredTechnicalKeys: ["beanName"],
      },
      "user-a",
    ) as string,
    /대표 기술값/,
  );
});

test("Daily Note 생성 API는 빈 이미지 URL을 저장 대상에서 제외한다", () => {
  const result = validateDailyNoteCreateRequest(
    {
      imageUrls: [
        "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/user-a/note.jpg",
        "",
      ],
    },
    "user-a",
  );

  assert.notEqual(typeof result, "string");
  if (typeof result === "string") return;
  assert.deepEqual(result.imageUrls, [
    "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/user-a/note.jpg",
  ]);
});

test("Daily Note 생성 API는 다른 사용자 및 다른 업로드 경로를 거부한다", () => {
  const otherUserResult = validateDailyNoteCreateRequest(
    {
      imageUrls: [
        "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/user-b/note.jpg",
      ],
    },
    "user-a",
  );
  const otherFolderResult = validateDailyNoteCreateRequest(
    {
      imageUrls: [
        "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/uploads/user-a/note.jpg",
      ],
    },
    "user-a",
  );

  assert.equal(otherUserResult, "이미지 주소를 확인해주세요.");
  assert.equal(otherFolderResult, "이미지 주소를 확인해주세요.");
});
