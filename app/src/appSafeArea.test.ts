import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

test("Android 메인 WebView는 상태바 safe area를 확보한다", () => {
  const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const containerStyle = source.match(
    /container: \{[\s\S]*?\n  \},\n  webView:/,
  )?.[0];

  assert.ok(containerStyle);
  assert.match(
    containerStyle,
    /paddingTop: Platform\.OS === "android" \? NativeStatusBar\.currentHeight : 0/,
  );
});
