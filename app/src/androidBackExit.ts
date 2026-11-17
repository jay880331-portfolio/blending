export const androidExitPromptWindowMs = 2000;

export type AndroidRootBackAction = "prompt" | "exit";

export function nextAndroidRootBackAction(
  lastPromptedAt: number | null,
  now: number,
): AndroidRootBackAction {
  if (
    lastPromptedAt !== null &&
    now - lastPromptedAt <= androidExitPromptWindowMs
  ) {
    return "exit";
  }

  return "prompt";
}
