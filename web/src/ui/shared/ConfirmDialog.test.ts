import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONFIRM_DIALOG_FAILURE_MESSAGE,
  canCloseConfirmDialog,
  isConfirmDialogBackdropClick,
  restoreConfirmDialogFocus,
  runConfirmDialogAction,
} from "./ConfirmDialog";

test("확인은 pending 중 한 번만 실행되고 취소와 Escape를 막는다", async () => {
  let resolve!: () => void;
  let calls = 0;
  const pending = { current: false };
  const action = () => {
    calls += 1;
    return new Promise<void>((done) => {
      resolve = done;
    });
  };

  const first = runConfirmDialogAction(action, pending);
  const second = runConfirmDialogAction(action, pending);
  assert.equal(calls, 1);
  assert.equal(canCloseConfirmDialog(pending.current), false);
  assert.equal(await second, "ignored");
  resolve();
  assert.equal(await first, "confirmed");
  assert.equal(canCloseConfirmDialog(pending.current), true);
});

test("실패한 확인은 오류 상태를 유지하고 URL 없는 고정 메시지를 사용한다", async () => {
  const pending = { current: false };
  assert.equal(
    await runConfirmDialogAction(async () => {
      throw new Error("https://private.example/delete");
    }, pending),
    "failed",
  );
  assert.equal(pending.current, false);
  assert.equal(
    CONFIRM_DIALOG_FAILURE_MESSAGE,
    "삭제에 실패했습니다. 다시 시도해주세요.",
  );
  assert.doesNotMatch(CONFIRM_DIALOG_FAILURE_MESSAGE, /https?:|\/\//);
});

test("backdrop만 취소하고 focus를 원래 트리거로 돌린다", () => {
  const backdrop = new EventTarget();
  const content = new EventTarget();
  let focused = 0;
  assert.equal(isConfirmDialogBackdropClick(backdrop, backdrop), true);
  assert.equal(isConfirmDialogBackdropClick(content, backdrop), false);
  restoreConfirmDialogFocus({ focus: () => focused++ });
  assert.equal(focused, 1);
});
