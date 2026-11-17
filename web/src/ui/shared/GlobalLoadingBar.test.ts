import assert from "node:assert/strict";
import { test } from "node:test";
import * as globalLoadingBar from "./GlobalLoadingBar";

test("일반 내부 경로 변경은 전역 로딩을 종료한다", () => {
  const shouldFinish = (
    globalLoadingBar as {
      shouldFinishRouteLoading?: (
        previousPathname: string,
        pathname: string,
        waitingForStop: boolean,
      ) => boolean;
    }
  ).shouldFinishRouteLoading;

  assert.equal(typeof shouldFinish, "function");
  assert.equal(
    shouldFinish!("/community", "/community/daily-note", false),
    true,
  );
  assert.equal(shouldFinish!("/community", "/community", false), false);
  assert.equal(shouldFinish!("/login", "/home", true), false);
});
