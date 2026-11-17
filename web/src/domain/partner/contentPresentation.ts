export function displayPartnerTitle(title: string, fallback: string) {
  return title.trim() || fallback;
}

export function normalizePartnerLineBreaks(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

export function partnerMultilineTextProps(value: string) {
  return {
    className: "whitespace-pre-line",
    children: normalizePartnerLineBreaks(value),
  };
}
