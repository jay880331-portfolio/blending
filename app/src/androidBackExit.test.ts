import {
  androidExitPromptWindowMs,
  nextAndroidRootBackAction,
} from "./androidBackExit";

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

assertEqual(nextAndroidRootBackAction(null, 1000), "prompt");
assertEqual(nextAndroidRootBackAction(1000, 1000), "exit");
assertEqual(
  nextAndroidRootBackAction(1000, 1000 + androidExitPromptWindowMs),
  "exit",
);
assertEqual(
  nextAndroidRootBackAction(1000, 1001 + androidExitPromptWindowMs),
  "prompt",
);
