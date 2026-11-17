import * as timing from "./splashTiming";

function assertEqual(actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual<T>(actual: readonly T[], expected: readonly T[]) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

assertEqual(timing.remainingSplashDuration(0, 500), 1100);
assertEqual(timing.remainingSplashDuration(0, 1600), 0);
assertEqual(timing.remainingSplashDuration(1000, 2000), 600);
assertEqual(timing.LETTER_FADE_MS, 100);
assertEqual(timing.LETTER_STAGGER_MS, 200);
assertEqual(timing.SPLASH_LOOP_MS, 3500);
assertEqual(timing.SPLASH_FADE_MS, 300);
assertEqual(timing.SIP_POSE_MS, 220);
assertDeepEqual(timing.SIP_POSE_SEQUENCE, [0, 1, 2, 2, 2, 1, 0, 0]);
assertEqual(timing.sipPoseAt(0, false), 0);
assertEqual(timing.sipPoseAt(1, false), 1);
assertEqual(timing.sipPoseAt(2, false), 2);
assertEqual(timing.sipPoseAt(8, false), 0);
assertEqual(timing.sipPoseAt(2, true), 0);
if (
  timing.SIP_POSE_SEQUENCE.length * timing.SIP_POSE_MS >
  timing.SPLASH_LOOP_MS
) {
  throw new Error("Expected sip pose cycle to fit within the splash loop");
}
assertDeepEqual(timing.LETTER_PATTERNS, [
  "110/101/110/101/110",
  "100/100/100/100/111",
  "111/100/110/100/111",
  "1001/1101/1011/1001/1001",
  "1110/1001/1001/1001/1110",
  "1/1/1/1/1",
  "1001/1101/1011/1001/1001",
  "111/100/101/101/111",
]);
