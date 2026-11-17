import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bootstrapAdmin } from "./bootstrap-admin";

describe("bootstrapAdmin", () => {
  it("performs no preparation or write during dry-run", async () => {
    let prepared = 0;
    let applied = 0;
    const logs: string[] = [];
    await bootstrapAdmin(
      { phone: "01000000000", apply: false },
      {
        async findUsers() {
          return [{ id: "user-1", name: "사용자", role: "barista" }];
        },
        async prepareApply() {
          prepared += 1;
        },
        async applyRole() {
          applied += 1;
        },
        log(message) {
          logs.push(message);
        },
      },
    );
    assert.equal(prepared, 0);
    assert.equal(applied, 0);
    assert.match(logs[0], /dry-run/);
  });

  it("prepares indexes before applying", async () => {
    const calls: string[] = [];
    await bootstrapAdmin(
      { phone: "01000000000", apply: true },
      {
        async findUsers() {
          return [{ id: "user-1", name: "사용자", role: "barista" }];
        },
        async prepareApply() {
          calls.push("prepare");
        },
        async applyRole() {
          calls.push("apply");
        },
        log() {},
      },
    );
    assert.deepEqual(calls, ["prepare", "apply"]);
  });
});
