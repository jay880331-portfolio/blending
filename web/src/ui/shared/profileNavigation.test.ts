import assert from "node:assert/strict";
import { test } from "node:test";
import * as navigation from "./profileNavigation";

const profileNavigation = navigation as {
  buildProfileHref?: (profileId: string, returnTo: string) => string;
  profilePageNavigation?: (returnTo?: string) => {
    backHref: string;
    active: "community" | "partner" | "mypage" | "map";
  };
};

test("프로필 링크는 id와 상세 내부 경로를 안전하게 인코딩한다", () => {
  assert.equal(typeof profileNavigation.buildProfileHref, "function");
  assert.equal(
    profileNavigation.buildProfileHref!("coffee/id", "/community/reviews/a b"),
    "/profile/coffee%2Fid?returnTo=%2Fcommunity%2Freviews%2Fa+b",
  );
});

test("프로필 뒤로가기와 하단 탭은 검증된 내부 returnTo만 따른다", () => {
  assert.equal(typeof profileNavigation.profilePageNavigation, "function");
  assert.deepEqual(
    profileNavigation.profilePageNavigation!("/partner/reviews/abc"),
    { backHref: "/partner/reviews/abc", active: "partner" },
  );
  assert.deepEqual(
    profileNavigation.profilePageNavigation!("/showroom/barista-1"),
    { backHref: "/showroom/barista-1", active: "map" },
  );
  assert.deepEqual(profileNavigation.profilePageNavigation!("//evil.example"), {
    backHref: "/map",
    active: "map",
  });
  assert.deepEqual(
    profileNavigation.profilePageNavigation!("https://evil.example"),
    {
      backHref: "/map",
      active: "map",
    },
  );
  assert.deepEqual(
    profileNavigation.profilePageNavigation!("/profile/member-1"),
    { backHref: "/profile/member-1", active: "mypage" },
  );
});
