import type { MemberRole } from "@/domain/member/types";

export type MemberSearchCandidate = {
  userId: string;
  role: MemberRole;
  accountStatus?: string;
  name: string;
  handle?: string;
  workplace?: string;
  blocked?: boolean;
  avatarUrl?: string;
};

export type MemberSearchHit = {
  userId: string;
  role: MemberRole;
  name: string;
  handle?: string;
  workplace?: string;
  avatarUrl?: string;
  href: string;
};

export function searchMembers(
  candidates: MemberSearchCandidate[],
  query: string,
): MemberSearchHit[] {
  const tokens = memberSearchTokens(query);
  if (tokens.length === 0) return [];

  return candidates
    .filter(
      (candidate) =>
        candidate.role !== "admin" &&
        (candidate.accountStatus === undefined ||
          candidate.accountStatus === "active") &&
        candidate.blocked !== true,
    )
    .filter((candidate) => {
      const identity = [candidate.name, candidate.handle, candidate.workplace]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => identity.includes(token));
    })
    .map((candidate) => ({
      userId: candidate.userId,
      role: candidate.role,
      name: candidate.name,
      handle: candidate.handle,
      workplace: candidate.workplace,
      avatarUrl: candidate.avatarUrl,
      href:
        candidate.role === "barista"
          ? `/map?barista=${encodeURIComponent(candidate.userId)}`
          : `/profile/${encodeURIComponent(candidate.userId)}`,
    }));
}

export function baristaIdFromMapSearch(search: string): string | null {
  return new URLSearchParams(search).get("barista") || null;
}

function memberSearchTokens(query: string) {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => token.replaceAll('"', "").replace(/^-+/, ""))
    .filter((token) => token.length >= 2)
    .map((token) => token.toLowerCase());
}
