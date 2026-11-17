export type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "low-accuracy"
  | "unsupported"
  | "unavailable";

type MessageRole = "admin" | "barista" | "enthusiast" | "partner";

export function canShowMapMessageAction({
  serverAllowed,
  viewerRole,
  isOwnProfile,
}: {
  serverAllowed: boolean;
  viewerRole?: MessageRole;
  isOwnProfile: boolean;
}) {
  if (isOwnProfile) return false;
  if (serverAllowed) return true;
  return (
    viewerRole === "admin" ||
    viewerRole === "barista" ||
    viewerRole === "partner"
  );
}
