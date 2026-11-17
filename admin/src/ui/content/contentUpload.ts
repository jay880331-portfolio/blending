export function mergeUploadedUrls(
  current: string,
  uploaded: string[],
  multiple: boolean,
) {
  if (!multiple) return uploaded.at(-1) ?? current;
  return [
    ...new Set([
      ...current
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      ...uploaded,
    ]),
  ].join("\n");
}
