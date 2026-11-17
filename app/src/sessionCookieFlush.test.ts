import assert from "node:assert/strict";
import test from "node:test";
import {
  insertAndroidCookieFlush,
  insertIosCookieSync,
} from "./sessionCookieFlush";

const androidTemplate = `package com.blending.app
import android.os.Bundle

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
}
`;

const iosTemplate = `import ReactAppDependencyProvider

class AppDelegate: ExpoAppDelegate {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

test("프리빌드는 앱이 백그라운드로 갈 때 웹뷰 쿠키를 남긴다", () => {
  const android = insertAndroidCookieFlush(androidTemplate);
  assert.match(android, /import android\.webkit\.CookieManager/);
  assert.match(android, /CookieManager\.getInstance\(\)\.flush\(\)/);
  assert.equal(insertAndroidCookieFlush(android), android);

  const ios = insertIosCookieSync(iosTemplate);
  assert.match(ios, /import WebKit/);
  assert.match(ios, /applicationWillResignActive/);
  assert.match(ios, /applicationDidEnterBackground/);
  assert.match(ios, /httpCookieStore\.getAllCookies/);
  assert.equal(insertIosCookieSync(ios), ios);
});
