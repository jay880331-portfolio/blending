import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  profileClusterMarkerContent,
  profileMarkerContent,
  userLocationMarkerContent,
} from "./mapMarkerPresentation";

const profile = {
  name: "이름",
  avatarUrl: "https://example.com/avatar.jpg",
  online: true,
};

describe("userLocationMarkerContent", () => {
  it("renders a compact 22px point inside a persistent 104px halo", () => {
    const content = userLocationMarkerContent();

    assert.match(content, /width:104px;height:104px/);
    assert.match(content, /width:22px;height:22px/);
    assert.match(content, /map-user-location-wave-fill/);
    assert.match(content, /map-user-location-wave-ring/);
    assert.doesNotMatch(content, /<svg/);
  });
});

describe("profileMarkerContent", () => {
  it("renders a compact avatar marker with an online indicator", () => {
    const content = profileMarkerContent(profile, false);

    assert.match(content, /width:34px;height:34px/);
    assert.match(content, /src="https:\/\/example.com\/avatar.jpg"/);
    assert.match(content, /width:10px;height:10px/);
    assert.match(content, /background:var\(--success\)/);
  });

  it("upgrades an http avatar URL to https", () => {
    const content = profileMarkerContent(
      {
        ...profile,
        avatarUrl: "http://k.kakaocdn.net/dn/example/img_640x640.jpg",
      },
      false,
    );

    assert.match(
      content,
      /src="https:\/\/k\.kakaocdn\.net\/dn\/example\/img_640x640\.jpg"/,
    );
    assert.doesNotMatch(content, /src="http:\/\//);
  });
});

describe("profileClusterMarkerContent", () => {
  it("uses the default avatar and shows the total group count", () => {
    const content = profileClusterMarkerContent(profile, 12, false);

    assert.match(content, /width:36px;height:36px/);
    assert.match(content, /<svg aria-hidden="true" width="18" height="18"/);
    assert.doesNotMatch(content, /<img/);
    assert.match(content, />\+12<\/span>/);
    assert.match(content, /min-width:19px;height:19px/);
  });

  it("uses the accent for the selected marker ring, tail, and badge", () => {
    const content = profileClusterMarkerContent(profile, 3, true);

    assert.match(content, /border:2\.5px solid var\(--accent\)/);
    assert.match(content, /border-top:5px solid var\(--accent\)/);
    assert.match(content, /background:var\(--accent\)/);
  });
});
