import assert from "node:assert/strict";
import { test } from "node:test";

test("Daily Note 이미지는 업로드 R2 HTTPS 호스트만 허용한다", async () => {
  const previousBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  process.env.R2_PUBLIC_BASE_URL = "https://images.blending.example";
  const { isAllowedDailyNoteImageUrl } = await import("./dailyNoteImageUrl");
  assert.equal(
    isAllowedDailyNoteImageUrl(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/note.jpg",
    ),
    true,
  );
  assert.equal(
    isAllowedDailyNoteImageUrl("https://example.com/note.jpg"),
    false,
  );
  assert.equal(
    isAllowedDailyNoteImageUrl(
      "http://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/note.jpg",
    ),
    false,
  );

  assert.equal(
    isAllowedDailyNoteImageUrl(
      "https://images.blending.example/daily-notes/note.jpg",
    ),
    true,
  );

  if (previousBaseUrl === undefined) delete process.env.R2_PUBLIC_BASE_URL;
  else process.env.R2_PUBLIC_BASE_URL = previousBaseUrl;
});

test("Daily Note 이미지는 현재 사용자 R2 경로만 허용한다", async () => {
  const {
    dailyNoteImageFolder,
    isAllowedDailyNoteImageUrl,
    isDailyNoteImageFolder,
    resolveDailyNoteImageUploadFolder,
    shouldRejectDailyNoteUploadKind,
  } = await import("./dailyNoteImageUrl");
  assert.equal(dailyNoteImageFolder("user/a"), "daily-notes/user-a");
  assert.equal(isDailyNoteImageFolder("daily-notes"), true);
  assert.equal(isDailyNoteImageFolder("daily-notes/other-user"), true);
  assert.equal(isDailyNoteImageFolder("uploads"), false);
  assert.equal(
    resolveDailyNoteImageUploadFolder("daily-notes/other-user", "user-a"),
    "daily-notes/user-a",
  );
  assert.equal(
    resolveDailyNoteImageUploadFolder("uploads", "user-a"),
    "uploads",
  );
  assert.equal(
    shouldRejectDailyNoteUploadKind("daily-notes", "profile-document"),
    true,
  );
  assert.equal(
    shouldRejectDailyNoteUploadKind("daily-notes/user-a", "partner-attachment"),
    true,
  );
  assert.equal(shouldRejectDailyNoteUploadKind("daily-notes", "image"), false);
  assert.equal(
    shouldRejectDailyNoteUploadKind("uploads", "profile-document"),
    false,
  );

  assert.equal(
    isAllowedDailyNoteImageUrl(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/user-a/note.jpg",
      "user-a",
    ),
    true,
  );
  assert.equal(
    isAllowedDailyNoteImageUrl(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/daily-notes/other-user/note.jpg",
      "user-a",
    ),
    false,
  );
  assert.equal(
    isAllowedDailyNoteImageUrl(
      "https://pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev/uploads/user-a/note.jpg",
      "user-a",
    ),
    false,
  );
});
