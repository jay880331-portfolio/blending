export function profileSocialHref(
  value: string,
  kind: "instagram" | "threads" | "website" | "recipe",
) {
  const clean = value.trim();
  if (!clean) return "#";
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  if (kind === "instagram") {
    return `https://instagram.com/${clean.replace(/^@/, "")}`;
  }
  if (kind === "threads") {
    return `https://threads.net/${clean.replace(/^@/, "")}`;
  }
  return `https://${clean}`;
}
