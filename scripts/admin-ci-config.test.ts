import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Admin CI contract", () => {
  it("exposes root Admin build and test commands", async () => {
    const root = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    assert.equal(
      root.scripts["build:admin"],
      "pnpm --filter @blending/admin build",
    );
    assert.equal(
      root.scripts.test,
      "pnpm -r --if-present test && pnpm --filter @blending/web exec tsx --test ../scripts/admin-ci-config.test.ts",
    );
  });

  it("runs static checks and both production builds", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/admin-ci.yml", import.meta.url),
      "utf8",
    );
    for (const command of [
      "pnpm --filter @blending/web check:architecture",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test",
      "@blending/web build",
      "@blending/admin build",
    ])
      assert.match(workflow, new RegExp(command.replaceAll("/", "\\/")));
  });

  it("runs Admin CI for every Web change on pull requests and main pushes", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/admin-ci.yml", import.meta.url),
      "utf8",
    );

    assert.equal(workflow.match(/- "web\/\*\*"/g)?.length, 2);
    assert.equal(workflow.match(/- "docs\/\*\*"/g)?.length, 2);
    assert.equal(workflow.match(/- "scripts\/\*\*"/g)?.length, 2);
  });

  it("documents the same public Web origin consumed by the Admin runtime", async () => {
    const paths = [
      "../admin/README.md",
      "../docs/admin-operations.md",
      "../docs/vercel-production-checklist.md",
    ];
    const documents = await Promise.all(
      paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
    );

    for (const document of documents) {
      assert.match(document, /NEXT_PUBLIC_WEB_ORIGIN/);
      assert.doesNotMatch(document, /NEXT_PUBLIC_API_BASE_URL/);
    }
  });

  it("keeps protected pages inside a route group instead of a quoted URL segment", async () => {
    const appUrl = new URL("../admin/app/", import.meta.url);
    const entries = await readdir(appUrl);

    assert.equal(entries.includes("'(protected)'"), false);
    for (const path of [
      "(protected)/layout.tsx",
      "(protected)/dashboard/page.tsx",
      "(protected)/statistics/page.tsx",
    ]) {
      await access(new URL(path, appUrl));
    }
  });

  it("serializes staging smoke and fails when secrets are missing", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/admin-smoke.yml", import.meta.url),
      "utf8",
    );
    assert.match(workflow, /group: admin-staging-smoke/);
    assert.match(workflow, /cancel-in-progress: false/);
    for (const name of [
      "ADMIN_SMOKE_BASE_URL",
      "ADMIN_SMOKE_LOGIN_ID",
      "ADMIN_SMOKE_PASSWORD",
      "MONGODB_URI",
      "MONGODB_DB",
    ])
      assert.match(workflow, new RegExp(`test -n "\\$${name}"`));
  });
});
