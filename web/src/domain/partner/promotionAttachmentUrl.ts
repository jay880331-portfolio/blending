export const KNOWN_R2_PUBLIC_HOST =
  "pub-e7dd5464c9644eddb76c27c1b4a0c583.r2.dev";
export const PARTNER_PROMOTION_PREFIX = "/partner/promotions/";

export type PromotionAttachmentUrlConfig = {
  extraAllowedHost?: string | null;
  r2PublicBaseUrl?: string | null;
};

export function parseHttpsHostname(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.hostname : undefined;
  } catch {
    return undefined;
  }
}

export function resolveAllowedHosts(
  config?: PromotionAttachmentUrlConfig,
): string[] {
  const extraHost =
    config?.extraAllowedHost ?? parseHttpsHostname(config?.r2PublicBaseUrl);
  return [KNOWN_R2_PUBLIC_HOST, extraHost].filter(
    (hostname): hostname is string => Boolean(hostname),
  );
}

export function isAllowedPartnerPromotionAttachmentUrl(
  value: string,
  config?: PromotionAttachmentUrlConfig,
) {
  try {
    const url = new URL(value);
    const hosts = resolveAllowedHosts(config);
    return (
      url.protocol === "https:" &&
      hosts.includes(url.hostname) &&
      url.pathname.startsWith(PARTNER_PROMOTION_PREFIX) &&
      !url.pathname.includes("..")
    );
  } catch {
    return false;
  }
}

export function partnerPromotionPdfDownloadPath(
  sourceUrl: string,
  filename: string,
) {
  const params = new URLSearchParams({
    url: sourceUrl,
    disposition: "attachment",
    filename,
  });
  return `/api/partner/promotions/preview?${params.toString()}`;
}
