import assert from "node:assert/strict";
import test from "node:test";
import { forgetSessionToken } from "./sessionPersistence";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

test("기기에 남은 세션 토큰은 지운다", () => {
  const storage = memoryStorage({ "blending:session": "leftover" });

  forgetSessionToken(storage);

  assert.equal(storage.getItem("blending:session"), null);
});

test("저장소가 없어도 지우기는 실패하지 않는다", () => {
  forgetSessionToken(null);
});
