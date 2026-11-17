export function isContentOwner(ownerId: string | undefined, userId: string) {
  return ownerId === userId;
}
