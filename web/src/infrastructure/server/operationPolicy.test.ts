import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  operationSwitchForPublicMutation,
  requireOperationEnabled,
} from "./operationPolicy";

describe("operation policy", () => {
  it("blocks community writes with the maintenance message", async () => {
    await assert.rejects(
      () =>
        requireOperationEnabled("communityWriteEnabled", async () => ({
          revision: 3,
          signupEnabled: true,
          communityWriteEnabled: false,
          partnerWriteEnabled: true,
          reportingEnabled: true,
          maintenanceMessage: "점검 중입니다.",
          updatedAt: null,
          updatedBy: null,
        })),
      /점검 중입니다/,
    );
  });

  it("allows enabled operations", async () => {
    await requireOperationEnabled("reportingEnabled", async () => ({
      revision: 0,
      signupEnabled: true,
      communityWriteEnabled: true,
      partnerWriteEnabled: true,
      reportingEnabled: true,
      maintenanceMessage: null,
      updatedAt: null,
      updatedBy: null,
    }));
  });

  it("maps every public community and partner mutation route to a switch", () => {
    const apiRoot = join(process.cwd(), "app/api");
    for (const area of ["community", "partner"] as const) {
      const expected =
        area === "community" ? "communityWriteEnabled" : "partnerWriteEnabled";
      for (const file of routeFiles(join(apiRoot, area))) {
        const source = readFileSync(file, "utf8");
        const methods = source.matchAll(
          /export async function (POST|PUT|PATCH|DELETE)/g,
        );
        const pathname = `/${relative(join(process.cwd(), "app"), file)
          .replaceAll("[id]", "example")
          .replaceAll("[commentId]", "comment")
          .replace(/\/route\.ts$/, "")}`;
        for (const [, method] of methods)
          assert.equal(
            operationSwitchForPublicMutation(method, pathname),
            expected,
            `${method} ${pathname}`,
          );
      }
    }
    assert.equal(
      operationSwitchForPublicMutation("GET", "/api/community/qa"),
      null,
    );
  });
});

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? routeFiles(path)
      : entry.name === "route.ts"
        ? [path]
        : [];
  });
}
