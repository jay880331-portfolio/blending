import type { Db } from "mongodb";
import type { MemberProfile } from "@/domain/member/types";
import type { UserDocument } from "@/infrastructure/server/auth";

type AuthorProfileLookup = {
  byOwnerId: Map<string, string>;
  handleByOwnerId?: Map<string, string>;
  byName: Map<string, string>;
};

type AuthorProfileSource = {
  ownerId?: string;
  name?: string;
};

type ProfileDocument = Pick<MemberProfile, "name" | "handle" | "avatarUrl"> & {
  ownerId?: string;
};

type UserProfileDocument = Pick<
  UserDocument,
  "id" | "name" | "handle" | "avatarUrl"
>;

export async function getAuthorProfileLookup(
  db: Db,
  sources: AuthorProfileSource[],
): Promise<AuthorProfileLookup> {
  const ownerIds = uniqueStrings(sources.map((source) => source.ownerId));
  const names = uniqueStrings(sources.map((source) => source.name));
  if (!ownerIds.length && !names.length) {
    return {
      byOwnerId: new Map(),
      handleByOwnerId: new Map(),
      byName: new Map(),
    };
  }

  const profileQuery = {
    $or: [
      ...(ownerIds.length ? [{ ownerId: { $in: ownerIds } }] : []),
      ...(names.length ? [{ name: { $in: names } }] : []),
      ...(names.length ? [{ handle: { $in: names } }] : []),
    ],
  };
  const userQuery = {
    $or: [
      ...(ownerIds.length ? [{ id: { $in: ownerIds } }] : []),
      ...(names.length ? [{ name: { $in: names } }] : []),
      ...(names.length ? [{ handle: { $in: names } }] : []),
    ],
  };

  const [profiles, users] = await Promise.all([
    db
      .collection<ProfileDocument>("member_profiles")
      .find(profileQuery)
      .project<ProfileDocument>({
        ownerId: 1,
        name: 1,
        handle: 1,
        avatarUrl: 1,
      })
      .toArray(),
    db
      .collection<UserProfileDocument>("users")
      .find(userQuery)
      .project<UserProfileDocument>({
        id: 1,
        name: 1,
        handle: 1,
        avatarUrl: 1,
      })
      .toArray(),
  ]);

  const byOwnerId = new Map<string, string>();
  const handleByOwnerId = new Map<string, string>();
  const avatarByName = new Map<string, string | null>();
  for (const profile of profiles) {
    if (profile.ownerId && profile.handle) {
      handleByOwnerId.set(profile.ownerId, profile.handle);
    }
    if (profile.ownerId && profile.avatarUrl) {
      byOwnerId.set(profile.ownerId, profile.avatarUrl);
    }
    addUniqueNameAvatar(avatarByName, profile.name, profile.avatarUrl);
    addUniqueNameAvatar(avatarByName, profile.handle, profile.avatarUrl);
  }
  for (const user of users) {
    if (!handleByOwnerId.has(user.id) && user.handle) {
      handleByOwnerId.set(user.id, user.handle);
    }
    if (!byOwnerId.has(user.id) && user.avatarUrl) {
      byOwnerId.set(user.id, user.avatarUrl);
    }
    addUniqueNameAvatar(avatarByName, user.name, user.avatarUrl);
    addUniqueNameAvatar(avatarByName, user.handle, user.avatarUrl);
  }

  return {
    byOwnerId,
    handleByOwnerId,
    byName: new Map(
      [...avatarByName.entries()].filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    ),
  };
}

export function resolveAuthorName(
  lookup: AuthorProfileLookup,
  source: AuthorProfileSource,
) {
  return (
    (source.ownerId && lookup.handleByOwnerId?.get(source.ownerId)) ??
    source.name
  );
}

export function resolveAuthorAvatar(
  lookup: AuthorProfileLookup,
  source: AuthorProfileSource,
) {
  if (source.ownerId) {
    const avatarUrl = lookup.byOwnerId.get(source.ownerId);
    if (avatarUrl) return avatarUrl;
  }

  if (source.name) {
    const avatarUrl = lookup.byName.get(source.name);
    if (avatarUrl) return avatarUrl;
  }

  return undefined;
}

function uniqueStrings(values: Array<string | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function addUniqueNameAvatar(
  avatars: Map<string, string | null>,
  name: string | undefined,
  avatarUrl: string | undefined,
) {
  if (!name || !avatarUrl) return;
  const current = avatars.get(name);
  if (current === undefined) {
    avatars.set(name, avatarUrl);
    return;
  }
  if (current !== avatarUrl) avatars.set(name, null);
}
