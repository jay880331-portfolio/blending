import type { QaPost } from "@/domain/community/types";
import {
  getAuthorProfileLookup,
  resolveAuthorAvatar,
} from "@/infrastructure/mongodb/authorProfiles";
import type { getCurrentUser } from "@/infrastructure/server/auth";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";

type OwnedComment = QaPost["comments"][number] & { ownerId?: string };

export function collectCommentIds(comments: QaPost["comments"]): string[] {
  const ids: string[] = [];
  const visit = (items: QaPost["comments"]) => {
    for (const comment of items) {
      ids.push(comment.id);
      if (comment.replies?.length) visit(comment.replies);
    }
  };
  visit(comments);
  return ids;
}

export function markCommentOwnership(
  comments: QaPost["comments"],
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  isAdmin: boolean,
  activeOwnerIds: Set<string>,
  profileLookup: Awaited<ReturnType<typeof getAuthorProfileLookup>>,
  likedIds: Set<string> = new Set(),
): QaPost["comments"] {
  return comments.map((comment) => {
    const ownedComment = comment as OwnedComment;
    const publicComment = { ...ownedComment };
    delete publicComment.ownerId;
    const isDeleted = Boolean(comment.isDeleted);
    if (isDeleted) delete publicComment.authorId;
    const isWithdrawnAuthor =
      !isDeleted &&
      Boolean(ownedComment.ownerId) &&
      !activeOwnerIds.has(ownedComment.ownerId ?? "");
    const isOwner =
      !isDeleted &&
      !isWithdrawnAuthor &&
      Boolean(user && isContentOwner(ownedComment.ownerId, user.id));
    const canManage = !isDeleted && !isWithdrawnAuthor && (isAdmin || isOwner);

    return {
      ...publicComment,
      ...(!isDeleted && ownedComment.ownerId
        ? { authorId: ownedComment.ownerId }
        : {}),
      body: isDeleted ? "삭제된 댓글입니다." : comment.body,
      authorName: isDeleted
        ? "댓글 작성자"
        : isWithdrawnAuthor
          ? "탈퇴한 유저"
          : comment.authorName,
      authorAvatarUrl:
        isDeleted || isWithdrawnAuthor
          ? undefined
          : (comment.authorAvatarUrl ??
            resolveAuthorAvatar(profileLookup, {
              ownerId: ownedComment.ownerId,
              name: comment.authorName,
            })),
      isDeleted,
      isWithdrawnAuthor,
      isOwner,
      canManage,
      liked: likedIds.has(comment.id),
      replies: comment.replies
        ? markCommentOwnership(
            comment.replies,
            user,
            isAdmin,
            activeOwnerIds,
            profileLookup,
            likedIds,
          )
        : undefined,
    };
  });
}
