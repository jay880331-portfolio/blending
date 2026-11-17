export const BLOCKED_USER_EVENT = "blending:blocked-user";

export function dispatchBlockedUser(
  userId: string,
  target: EventTarget = window,
) {
  target.dispatchEvent(
    new CustomEvent(BLOCKED_USER_EVENT, { detail: { userId } }),
  );
}

export function listenForBlockedUser(
  onBlock: (userId: string) => void,
  target: EventTarget = window,
) {
  const listener = (event: Event) => {
    const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
    if (userId) onBlock(userId);
  };
  target.addEventListener(BLOCKED_USER_EVENT, listener);
  return () => target.removeEventListener(BLOCKED_USER_EVENT, listener);
}

export function filterBlockedUserItems<T extends { authorId?: string }>(
  items: T[],
  userId: string,
) {
  return items.filter((item) => item.authorId !== userId);
}

export function filterBlockedUserComments<
  T extends { authorId?: string; replies?: T[] },
>(items: T[], userId: string): T[] {
  return items.flatMap((item) => {
    if (item.authorId === userId) return [];
    return [
      item.replies
        ? ({
            ...item,
            replies: filterBlockedUserComments(item.replies, userId),
          } as T)
        : item,
    ];
  });
}

export function countComments<T extends { replies?: T[] }>(items: T[]): number {
  return items.reduce(
    (count, item) => count + 1 + countComments(item.replies ?? []),
    0,
  );
}
