export const LETTER_FADE_MS = 100;
export const LETTER_STAGGER_MS = 200;
export const SPLASH_LOOP_MS = 3500;
export const SPLASH_FADE_MS = 300;
export const MIN_SPLASH_DURATION_MS = 1600;
export const SIP_POSE_MS = 220;
export const SIP_POSE_SEQUENCE = [0, 1, 2, 2, 2, 1, 0, 0] as const;

export const LETTER_PATTERNS = [
  "110/101/110/101/110",
  "100/100/100/100/111",
  "111/100/110/100/111",
  "1001/1101/1011/1001/1001",
  "1110/1001/1001/1001/1110",
  "1/1/1/1/1",
  "1001/1101/1011/1001/1001",
  "111/100/101/101/111",
] as const;

export function remainingSplashDuration(
  startedAt: number,
  now: number,
  minimumDuration = MIN_SPLASH_DURATION_MS,
) {
  return Math.max(0, minimumDuration - (now - startedAt));
}

export function sipPoseAt(tick: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;

  return SIP_POSE_SEQUENCE[tick % SIP_POSE_SEQUENCE.length];
}
