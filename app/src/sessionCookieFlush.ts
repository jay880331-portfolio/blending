const androidFlush = `  override fun onPause() {
    runCatching { CookieManager.getInstance().flush() }
    super.onPause()
  }`;

const iosCookieSync = `  public override func applicationWillResignActive(_ application: UIApplication) {
    WKWebsiteDataStore.default().httpCookieStore.getAllCookies { _ in }
    super.applicationWillResignActive(application)
  }

  public override func applicationDidEnterBackground(_ application: UIApplication) {
    WKWebsiteDataStore.default().httpCookieStore.getAllCookies { _ in }
    super.applicationDidEnterBackground(application)
  }`;

export function insertAndroidCookieFlush(contents: string) {
  if (contents.includes("CookieManager.getInstance().flush()")) return contents;

  const importAnchor = "import android.os.Bundle\n";
  const methodAnchor = "super.onCreate(null)\n  }";
  if (!contents.includes(importAnchor) || !contents.includes(methodAnchor)) {
    throw new Error(
      "Android MainActivity template changed; cookie flush was not inserted",
    );
  }

  return contents
    .replace(
      importAnchor,
      "import android.os.Bundle\nimport android.webkit.CookieManager\n",
    )
    .replace(methodAnchor, `super.onCreate(null)\n  }\n\n${androidFlush}`);
}

export function insertIosCookieSync(contents: string) {
  if (contents.includes("httpCookieStore.getAllCookies")) return contents;

  const importAnchor = "import ReactAppDependencyProvider\n";
  const methodAnchor =
    "return super.application(application, didFinishLaunchingWithOptions: launchOptions)\n  }";
  if (!contents.includes(importAnchor) || !contents.includes(methodAnchor)) {
    throw new Error(
      "iOS AppDelegate template changed; cookie sync was not inserted",
    );
  }

  return contents
    .replace(
      importAnchor,
      "import ReactAppDependencyProvider\nimport WebKit\n",
    )
    .replace(methodAnchor, `${methodAnchor}\n\n${iosCookieSync}`);
}
