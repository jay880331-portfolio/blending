import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeProject,
  classifyPath,
  collectImports,
  diffBaseline,
  evaluateRules,
  resolveSpecifier,
  sortViolations,
  type FileSystemReader,
  type ResolvedTarget,
  type Violation,
} from "./check-architecture";

describe("collectImports AST extraction", () => {
  it("extracts static import, type-only import, export from, and dynamic import", () => {
    const code = `
      import { something } from "@/infrastructure/db";
      import type { DbSession } from "mongodb";
      export { sharedUtil } from "@/infrastructure/shared";
      export type { SharedType } from "@/infrastructure/types";

      export async function load() {
        const mod = await import("@/infrastructure/dynamic");
        return mod;
      }
    `;

    const imports = collectImports(code, "test.ts");
    assert.equal(imports.length, 5);

    assert.deepEqual(imports[0], {
      specifier: "@/infrastructure/db",
      isTypeOnly: false,
      kind: "import",
    });
    assert.deepEqual(imports[1], {
      specifier: "mongodb",
      isTypeOnly: true,
      kind: "import",
    });
    assert.deepEqual(imports[2], {
      specifier: "@/infrastructure/shared",
      isTypeOnly: false,
      kind: "export-from",
    });
    assert.deepEqual(imports[3], {
      specifier: "@/infrastructure/types",
      isTypeOnly: true,
      kind: "export-from",
    });
    assert.deepEqual(imports[4], {
      specifier: "@/infrastructure/dynamic",
      isTypeOnly: false,
      kind: "dynamic-import",
    });
  });
});

describe("classifyPath", () => {
  it("classifies repo-relative paths correctly", () => {
    assert.equal(classifyPath("web/src/domain/user.ts"), "domain");
    assert.equal(classifyPath("web/src/application/order.ts"), "application");
    assert.equal(
      classifyPath("web/src/infrastructure/db.ts"),
      "infrastructure",
    );
    assert.equal(classifyPath("web/src/ui/Button.tsx"), "ui");
    assert.equal(classifyPath("web/src/store/userStore.ts"), "store");
    assert.equal(classifyPath("web/src/adapters/http.ts"), "adapters");
    assert.equal(classifyPath("web/src/bridge/types.ts"), "bridge");
    assert.equal(classifyPath("web/app/api/admin/route.ts"), "app");
    assert.equal(classifyPath("package.json"), "other");
  });
});

describe("evaluateRules boundary checks", () => {
  const dummyInfraTarget: ResolvedTarget = {
    rawSpecifier: "@/infrastructure/db",
    isExternal: false,
    targetPath: "web/src/infrastructure/db.ts",
    targetLayer: "infrastructure",
  };

  const dummyDomainTarget: ResolvedTarget = {
    rawSpecifier: "@/domain/entity",
    isExternal: false,
    targetPath: "web/src/domain/entity.ts",
    targetLayer: "domain",
  };

  const dummyMongoTarget: ResolvedTarget = {
    rawSpecifier: "mongodb",
    isExternal: true,
    externalPackage: "mongodb",
  };

  const dummyNextTarget: ResolvedTarget = {
    rawSpecifier: "next/server",
    isExternal: true,
    externalPackage: "next",
  };

  it("fails when domain imports outer layers or frameworks (domain-no-outer)", () => {
    const v1 = evaluateRules(
      "web/src/domain/model.ts",
      "domain",
      dummyInfraTarget,
    );
    assert.equal(v1.length, 1);
    assert.equal(v1[0]?.rule, "domain-no-outer");

    const v2 = evaluateRules(
      "web/src/domain/model.ts",
      "domain",
      dummyMongoTarget,
    );
    assert.equal(v2.length, 1);
    assert.equal(v2[0]?.rule, "domain-no-outer");

    const v3 = evaluateRules(
      "web/src/domain/model.ts",
      "domain",
      dummyNextTarget,
    );
    assert.equal(v3.length, 1);
    assert.equal(v3[0]?.rule, "domain-no-outer");

    // domain -> domain is allowed
    const vOk = evaluateRules(
      "web/src/domain/model.ts",
      "domain",
      dummyDomainTarget,
    );
    assert.equal(vOk.length, 0);
  });

  it("fails when application imports infrastructure (application-no-infrastructure)", () => {
    const v = evaluateRules(
      "web/src/application/useCase.ts",
      "application",
      dummyInfraTarget,
    );
    assert.equal(v.length, 1);
    assert.equal(v[0]?.rule, "application-no-infrastructure");
    assert.equal(v[0]?.target, "web/src/infrastructure/db.ts");

    // application -> domain is allowed
    const vOk = evaluateRules(
      "web/src/application/useCase.ts",
      "application",
      dummyDomainTarget,
    );
    assert.equal(vOk.length, 0);
  });

  it("fails when application imports framework libraries (application-no-framework)", () => {
    const vMongo = evaluateRules(
      "web/src/application/useCase.ts",
      "application",
      dummyMongoTarget,
    );
    assert.equal(vMongo.length, 1);
    assert.equal(vMongo[0]?.rule, "application-no-framework");

    const vNext = evaluateRules(
      "web/src/application/useCase.ts",
      "application",
      dummyNextTarget,
    );
    assert.equal(vNext.length, 1);
    assert.equal(vNext[0]?.rule, "application-no-framework");
  });

  it("fails when ui or store imports infrastructure or mongodb (ui-store-no-server-infrastructure)", () => {
    const vUi = evaluateRules("web/src/ui/App.tsx", "ui", dummyInfraTarget);
    assert.equal(vUi.length, 1);
    assert.equal(vUi[0]?.rule, "ui-store-no-server-infrastructure");

    const vStore = evaluateRules(
      "web/src/store/userStore.ts",
      "store",
      dummyMongoTarget,
    );
    assert.equal(vStore.length, 1);
    assert.equal(vStore[0]?.rule, "ui-store-no-server-infrastructure");

    // ui -> domain is allowed
    const vUiOk = evaluateRules("web/src/ui/App.tsx", "ui", dummyDomainTarget);
    assert.equal(vUiOk.length, 0);
  });

  it("allows infrastructure -> application", () => {
    const appTarget: ResolvedTarget = {
      rawSpecifier: "@/application/port",
      isExternal: false,
      targetPath: "web/src/application/port.ts",
      targetLayer: "application",
    };
    const v = evaluateRules(
      "web/src/infrastructure/repo.ts",
      "infrastructure",
      appTarget,
    );
    assert.equal(v.length, 0);
  });

  it("allows app -> infrastructure and app -> application", () => {
    const v1 = evaluateRules("web/app/api/route.ts", "app", dummyInfraTarget);
    assert.equal(v1.length, 0);

    const appTarget: ResolvedTarget = {
      rawSpecifier: "@/application/port",
      isExternal: false,
      targetPath: "web/src/application/port.ts",
      targetLayer: "application",
    };
    const v2 = evaluateRules("web/app/api/route.ts", "app", appTarget);
    assert.equal(v2.length, 0);
  });
});

describe("diffBaseline", () => {
  const v1: Violation = {
    source: "web/src/application/a.ts",
    target: "mongodb",
    rule: "application-no-framework",
  };
  const v2: Violation = {
    source: "web/src/application/b.ts",
    target: "web/src/infrastructure/c.ts",
    rule: "application-no-infrastructure",
  };

  it("accepts existing violations in baseline", () => {
    const diff = diffBaseline([v1], [v1]);
    assert.equal(diff.newViolations.length, 0);
    assert.equal(diff.staleViolations.length, 0);
    assert.equal(diff.passedViolations.length, 1);
  });

  it("flags new violations not in baseline", () => {
    const diff = diffBaseline([v1, v2], [v1]);
    assert.equal(diff.newViolations.length, 1);
    assert.equal(diff.newViolations[0]?.source, "web/src/application/b.ts");
    assert.equal(diff.staleViolations.length, 0);
  });

  it("flags stale violations present in baseline but absent in code", () => {
    const diff = diffBaseline([v1], [v1, v2]);
    assert.equal(diff.newViolations.length, 0);
    assert.equal(diff.staleViolations.length, 1);
    assert.equal(diff.staleViolations[0]?.source, "web/src/application/b.ts");
  });
});

function createMockFs(files: Record<string, string>): FileSystemReader {
  return {
    readFile(filePath: string) {
      const norm = filePath.replace(/\\/g, "/");
      if (norm in files) return files[norm]!;
      throw new Error(`File not found: ${filePath}`);
    },
    fileExists(filePath: string) {
      const norm = filePath.replace(/\\/g, "/");
      return norm in files;
    },
  };
}

describe("resolveSpecifier resolution logic", () => {
  const mockRepoRoot = "/virtual/repo";

  it("classifies external npm packages as isExternal", () => {
    const result = resolveSpecifier(
      "mongodb",
      "web/src/application/service.ts",
      mockRepoRoot,
    );
    assert.equal(result.isExternal, true);
    assert.equal(result.externalPackage, "mongodb");
    assert.equal(result.targetPath, undefined);
  });

  it("resolves path aliases using tsconfig paths and directory index", () => {
    const files: Record<string, string> = {
      "/virtual/repo/web/tsconfig.json": JSON.stringify({
        compilerOptions: {
          paths: {
            "@/*": ["./src/*"],
          },
        },
      }),
      "/virtual/repo/web/src/domain/user/index.ts": "export const User = {};",
      "/virtual/repo/web/src/infrastructure/db.ts": "export const db = {};",
    };
    const fsReader = createMockFs(files);

    const fileResult = resolveSpecifier(
      "@/infrastructure/db",
      "web/src/application/service.ts",
      mockRepoRoot,
      fsReader,
    );
    assert.equal(fileResult.isExternal, false);
    assert.equal(fileResult.targetPath, "web/src/infrastructure/db.ts");

    const indexResult = resolveSpecifier(
      "@/domain/user",
      "web/src/application/service.ts",
      mockRepoRoot,
      fsReader,
    );
    assert.equal(indexResult.isExternal, false);
    assert.equal(indexResult.targetPath, "web/src/domain/user/index.ts");
  });
});

describe("sortViolations ordering", () => {
  it("sorts violations stably by source, target, then rule", () => {
    const violations: Violation[] = [
      {
        source: "web/src/b.ts",
        target: "web/src/c.ts",
        rule: "application-no-framework",
      },
      {
        source: "web/src/a.ts",
        target: "web/src/z.ts",
        rule: "application-no-infrastructure",
      },
      {
        source: "web/src/a.ts",
        target: "web/src/b.ts",
        rule: "application-no-infrastructure",
      },
      {
        source: "web/src/a.ts",
        target: "web/src/b.ts",
        rule: "application-no-framework",
      },
    ];

    const sorted = sortViolations(violations);
    assert.deepEqual(
      sorted.map((v) => `${v.source} -> ${v.target} (${v.rule})`),
      [
        "web/src/a.ts -> web/src/b.ts (application-no-framework)",
        "web/src/a.ts -> web/src/b.ts (application-no-infrastructure)",
        "web/src/a.ts -> web/src/z.ts (application-no-infrastructure)",
        "web/src/b.ts -> web/src/c.ts (application-no-framework)",
      ],
    );
  });
});

describe("analyzeProject with in-memory virtual filesystem", () => {
  const mockRepoRoot = "/virtual/repo";

  it("catches alias and relative bypasses, type-only imports, export-from, and dynamic imports", () => {
    const files: Record<string, string> = {
      "/virtual/repo/web/src/domain/model.ts": `
        export interface UserModel { id: string; }
      `,
      "/virtual/repo/web/src/infrastructure/db.ts": `
        export const dbConnection = "mongo://";
      `,
      "/virtual/repo/web/src/application/bypass.ts": `
        // Relative bypasses
        import { dbConnection } from "../infrastructure/db";
        import type { dbConnection as DbType } from "../infrastructure/db";
        export { dbConnection as reExported } from "../infrastructure/db";
        export type { dbConnection as ReExportedType } from "../infrastructure/db";
        export async function loadDb() {
          return await import("../infrastructure/db");
        }
      `,
      "/virtual/repo/web/src/infrastructure/repo.ts": `
        // Valid: infrastructure -> application
        import type { UserModel } from "@/domain/model";
      `,
      "/virtual/repo/web/app/api/admin.ts": `
        // Valid: app -> infrastructure & domain
        import { MongoRepo } from "@/infrastructure/repo";
        import type { UserModel } from "@/domain/model";
      `,
    };

    const fsReader = createMockFs(files);
    const fileList = [
      "web/src/domain/model.ts",
      "web/src/infrastructure/db.ts",
      "web/src/application/bypass.ts",
      "web/src/infrastructure/repo.ts",
      "web/app/api/admin.ts",
    ];

    const result = analyzeProject(fileList, mockRepoRoot, fsReader);

    assert.equal(result.unresolvedPaths.length, 0);

    // All 5 imports from bypass.ts target infrastructure, so 1 deduplicated violation is recorded:
    // (source: web/src/application/bypass.ts, target: web/src/infrastructure/db.ts, rule: application-no-infrastructure)
    assert.equal(result.violations.length, 1);
    assert.equal(result.violations[0]?.source, "web/src/application/bypass.ts");
    assert.equal(result.violations[0]?.target, "web/src/infrastructure/db.ts");
    assert.equal(result.violations[0]?.rule, "application-no-infrastructure");
  });

  it("reports unresolved relative or alias paths", () => {
    const files: Record<string, string> = {
      "/virtual/repo/web/src/application/broken.ts": `
        import { missing } from "@/infrastructure/nonexistent";
        import { alsoMissing } from "./does-not-exist";
      `,
    };
    const fsReader = createMockFs(files);
    const result = analyzeProject(
      ["web/src/application/broken.ts"],
      mockRepoRoot,
      fsReader,
    );

    assert.equal(result.unresolvedPaths.length, 2);
    assert.equal(
      result.unresolvedPaths[0]?.specifier,
      "@/infrastructure/nonexistent",
    );
    assert.equal(result.unresolvedPaths[1]?.specifier, "./does-not-exist");
  });
});
