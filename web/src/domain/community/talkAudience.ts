export type TalkAudience = "enthusiast" | "barista";

export function resolveTalkAudience(audience?: string | null): TalkAudience {
  return audience === "enthusiast" ? "enthusiast" : "barista";
}

export function defaultTalkAudienceForRole(role?: string | null): TalkAudience {
  return role === "barista" ? "barista" : "enthusiast";
}

export function canWriteTalkAudience(
  role: string | undefined | null,
  audience: TalkAudience,
): boolean {
  if (role === "admin") return true;
  if (role === "enthusiast") return audience === "enthusiast";
  if (role === "barista") return audience === "barista";
  return false;
}
