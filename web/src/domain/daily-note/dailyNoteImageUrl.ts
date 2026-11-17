function r2PublicHostname() {
  try {
    const url = new URL(process.env.R2_PUBLIC_BASE_URL ?? "");
    return url.protocol === "https:" ? url.hostname : undefined;
  } catch {
    return undefined;
  }
}

export const DAILY_NOTE_IMAGE_HOSTNAMES = [
  "pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev",
  ...[r2PublicHostname()].filter((hostname): hostname is string =>
    Boolean(hostname),
  ),
];

export function dailyNoteImageFolder(userId: string) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "-") || "user";
  return `daily-notes/${safeUserId}`;
}

export function isDailyNoteImageFolder(folder: string) {
  return folder === "daily-notes" || folder.startsWith("daily-notes/");
}

export function resolveDailyNoteImageUploadFolder(
  requestedFolder: string,
  userId: string,
) {
  return isDailyNoteImageFolder(requestedFolder)
    ? dailyNoteImageFolder(userId)
    : requestedFolder;
}

export function shouldRejectDailyNoteUploadKind(folder: string, kind: string) {
  return isDailyNoteImageFolder(folder) && kind !== "image";
}

export function isAllowedDailyNoteImageUrl(value: string, userId?: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      DAILY_NOTE_IMAGE_HOSTNAMES.includes(url.hostname) &&
      (userId === undefined ||
        url.pathname.startsWith(`/${dailyNoteImageFolder(userId)}/`))
    );
  } catch {
    return false;
  }
}
