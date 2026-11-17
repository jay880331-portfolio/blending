import assert from "node:assert/strict";
import test from "node:test";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import imageLoader from "next/dist/shared/lib/image-loader";
import config from "./next.config";

const imageConfig = { ...imageConfigDefault, ...config.images };
for (const src of [
  "http://k.kakaocdn.net/dn/example/photo.jpg",
  "https://k.kakaocdn.net/dn/example/photo.jpg",
  "http://img1.kakaocdn.net/thumb/R640x640.q70/?fname=http%3A%2F%2Ft1.kakaocdn.net%2Faccount_images%2Fdefault_profile.jpeg",
  "https://t1.kakaocdn.net/account_images/default_profile.jpeg",
  "https://ssl.pstatic.net/static/pwe/address/img_profile.png",
]) {
  test(`configured profile image is accepted: ${src}`, () => {
    assert.match(
      imageLoader({ config: imageConfig, src, width: 80, quality: 75 }),
      /^\/_next\/image\?/,
    );
  });
}
for (const src of [
  "https://example.com/photo.jpg",
  "https://k.kakaocdn.net.evil.example/photo.jpg",
]) {
  test(`unconfigured image stays blocked: ${src}`, () => {
    assert.throws(
      () => imageLoader({ config: imageConfig, src, width: 80, quality: 75 }),
      /not configured/,
    );
  });
}
