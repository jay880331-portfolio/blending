export function blockedOwnerFilter(blockedOwnerIds: string[]) {
  return blockedOwnerIds.length ? { ownerId: { $nin: blockedOwnerIds } } : {};
}

export function filterBlockedOwners<T extends { ownerId?: string }>(
  items: T[],
  blockedOwnerIds: string[],
) {
  const blocked = new Set(blockedOwnerIds);
  return items.filter((item) => !item.ownerId || !blocked.has(item.ownerId));
}

export function filterBlockedComments<
  T extends { ownerId?: string; replies?: T[] },
>(items: T[], blockedOwnerIds: string[]): T[] {
  const blocked = new Set(blockedOwnerIds);
  return items.flatMap((item) => {
    if (item.ownerId && blocked.has(item.ownerId)) return [];
    return [
      {
        ...item,
        ...(item.replies
          ? { replies: filterBlockedComments(item.replies, blockedOwnerIds) }
          : {}),
      },
    ];
  });
}

export function countVisibleComments<T extends { replies?: T[] }>(
  items: T[],
): number {
  return items.reduce(
    (count, item) => count + 1 + countVisibleComments(item.replies ?? []),
    0,
  );
}
