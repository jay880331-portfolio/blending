export type MapMarkerPresentationProfile = {
  name: string;
  avatarUrl?: string;
  online: boolean;
  hasNotice?: boolean;
  hasTimesale?: boolean;
  stamped?: boolean;
  canRedeem?: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function defaultAvatarContent(size: number) {
  const iconSize = Math.round(size * 0.5);
  return `
    <svg aria-hidden="true" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" stroke-width="1.8" stroke-linecap="round">
      <circle cx="12" cy="8" r="3.4"></circle>
      <path d="M5.5 20c.6-3.6 3.3-5.6 6.5-5.6s5.9 2 6.5 5.6"></path>
    </svg>
  `;
}

function markerAvatarUrl(url: string) {
  return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
}

function avatarContent(profile: MapMarkerPresentationProfile, size: number) {
  if (profile.avatarUrl) {
    return `<img src="${escapeHtml(markerAvatarUrl(profile.avatarUrl))}" alt="" style="display:block;width:100%;height:100%;border-radius:9999px;object-fit:cover;" />`;
  }

  return defaultAvatarContent(size);
}

function onlineIndicator(profile: MapMarkerPresentationProfile) {
  if (!profile.online) return "";

  return '<span style="position:absolute;right:-2px;top:-2px;z-index:3;width:10px;height:10px;box-sizing:border-box;border-radius:9999px;border:2px solid var(--surface);background:var(--success);"></span>';
}

function storeBadgeIndicator(
  hasNotice?: boolean,
  hasTimesale?: boolean,
  stamped?: boolean,
  canRedeem?: boolean,
) {
  const badges: string[] = [];
  if (hasTimesale) {
    badges.push(
      '<span style="position:absolute;left:-6px;top:-5px;z-index:4;display:flex;height:16px;align-items:center;border-radius:9999px;border:1.5px solid var(--surface);background:var(--accent);padding:0 4px;color:var(--surface);font-family:var(--font-body);font-size:9px;font-weight:700;line-height:1;white-space:nowrap;">세일</span>',
    );
  } else if (hasNotice) {
    badges.push(
      '<span style="position:absolute;left:-2px;top:-2px;z-index:4;width:9px;height:9px;box-sizing:border-box;border-radius:9999px;border:1.5px solid var(--surface);background:var(--fg);"></span>',
    );
  }
  if (stamped) {
    const label = canRedeem ? "✓ 교환 가능" : "✓ 방문";
    badges.push(
      `<span style="position:absolute;left:50%;bottom:-13px;transform:translateX(-50%);z-index:5;display:flex;height:15px;align-items:center;border-radius:9999px;border:1px solid var(--border-strong);background:var(--surface);padding:0 5px;color:var(--fg-strong);font-family:var(--font-body);font-size:9px;font-weight:700;line-height:1;white-space:nowrap;">${label}</span>`,
    );
  }
  return badges.join("");
}

export function profileMarkerContent(
  profile: MapMarkerPresentationProfile,
  selected: boolean,
) {
  const markerColor = selected ? "var(--accent)" : "var(--surface)";

  return `
    <div role="button" aria-label="${escapeHtml(profile.name)} 프로필 보기" style="position:relative;width:44px;height:49px;cursor:pointer;">
      <span style="position:absolute;left:5px;top:0;display:flex;width:34px;height:34px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:9999px;border:2.5px solid ${markerColor};background:var(--surface-alt);box-shadow:0 3px 10px rgba(0,0,0,.22);">
        ${avatarContent(profile, 34)}
        ${onlineIndicator(profile)}
        ${storeBadgeIndicator(profile.hasNotice, profile.hasTimesale, profile.stamped, profile.canRedeem)}
      </span>
      <span style="position:absolute;left:18px;top:32px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ${markerColor};"></span>
    </div>
  `;
}

export function profileClusterMarkerContent(
  _profile: MapMarkerPresentationProfile,
  count: number,
  selected: boolean,
  options?: {
    hasNotice?: boolean;
    hasTimesale?: boolean;
    stamped?: boolean;
    canRedeem?: boolean;
  },
) {
  const markerColor = selected ? "var(--accent)" : "var(--surface)";
  const badgeColor = selected ? "var(--accent)" : "var(--fg)";

  return `
    <div role="button" aria-label="${count}명 바리스타 보기" style="position:relative;width:52px;height:49px;cursor:pointer;">
      <span style="position:absolute;left:4px;top:0;display:flex;width:36px;height:36px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:9999px;border:2.5px solid ${markerColor};background:var(--surface-alt);box-shadow:0 3px 10px rgba(0,0,0,.22);">
        ${defaultAvatarContent(36)}
        ${storeBadgeIndicator(options?.hasNotice, options?.hasTimesale, options?.stamped, options?.canRedeem)}
        <span style="position:absolute;right:-7px;bottom:-4px;z-index:4;display:flex;min-width:19px;height:19px;box-sizing:border-box;align-items:center;justify-content:center;border-radius:10px;border:2px solid var(--surface);background:${badgeColor};padding:0 5px;color:var(--surface);font-family:var(--font-body);font-size:10px;font-weight:700;line-height:15px;white-space:nowrap;">+${count}</span>
      </span>
      <span style="position:absolute;left:18px;top:34px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ${markerColor};"></span>
    </div>
  `;
}

export function userLocationMarkerContent() {
  return `
    <div aria-label="내 위치" style="position:relative;width:104px;height:104px;pointer-events:none;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:radial-gradient(circle,var(--accent-soft) 0%,color-mix(in srgb,var(--accent) 6%,transparent) 62%,transparent 72%);"></span>
      <span class="map-user-location-wave-fill" style="position:absolute;left:33px;top:33px;width:38px;height:38px;border-radius:9999px;background:color-mix(in srgb,var(--accent) 16%,transparent);"></span>
      <span class="map-user-location-wave-ring" style="position:absolute;left:33px;top:33px;width:38px;height:38px;box-sizing:border-box;border-radius:9999px;border:1.5px solid color-mix(in srgb,var(--accent) 45%,transparent);"></span>
      <span style="position:absolute;left:41px;top:41px;width:22px;height:22px;box-sizing:border-box;border-radius:9999px;border:3px solid var(--surface);background:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.28);"></span>
    </div>
  `;
}
