export function profileQrUrl(origin: string, profileId: string) {
  return new URL(
    `/open/profile/${encodeURIComponent(profileId)}`,
    origin,
  ).toString();
}
