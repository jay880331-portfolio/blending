import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("FAQ 화면은 모든 항목이 닫힌 상태로 시작한다", () => {
  const source = readFileSync(
    new URL("./HomeApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const \[openId, setOpenId\] = useState\(""\);/);
});
