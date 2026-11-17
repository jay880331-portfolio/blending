import assert from "node:assert/strict";
import test from "node:test";
import {
  createGuestProfile,
  profileWithUserDefaults,
} from "./memberMongoRepository";

const user = {
  role: "barista" as const,
  avatarUrl: "https://k.kakaocdn.net/account.jpg",
};
for (const [name, avatarUrl, expected] of [
  [
    "profile image wins",
    "https://example.com/own.jpg",
    "https://example.com/own.jpg",
  ],
  ["missing profile image uses account", undefined, user.avatarUrl],
  ["empty string remains an explicit empty value", "", ""],
] as const) {
  test(name, () => {
    const result = profileWithUserDefaults(
      { ...createGuestProfile(), avatarUrl },
      user,
    );
    assert.equal(result?.avatarUrl, expected);
    assert.equal(result?.role, "barista");
  });
}
test("null stored avatar also uses account image", () => {
  const profile = createGuestProfile();
  Reflect.set(profile, "avatarUrl", null);
  assert.equal(
    profileWithUserDefaults(profile, user)?.avatarUrl,
    user.avatarUrl,
  );
});
test("missing images stay missing", () => {
  assert.equal(
    profileWithUserDefaults(createGuestProfile(), { role: "barista" })
      ?.avatarUrl,
    undefined,
  );
});
test("missing user or profile remains unchanged", () => {
  const profile = createGuestProfile();
  assert.equal(profileWithUserDefaults(profile, null), profile);
  assert.equal(profileWithUserDefaults(null, user), null);
});
