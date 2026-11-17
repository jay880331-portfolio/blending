import type { ClientSession } from "mongodb";

export class UserBlockValidationError extends Error {}
export class UserBlockNotFoundError extends Error {}

export type UserBlockRepository = {
  userExists(userId: string): Promise<boolean>;
  create(
    blockerId: string,
    blockedId: string,
    session?: ClientSession,
  ): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
};

export async function blockUser(
  repository: UserBlockRepository,
  blockerId: string,
  blockedId: string,
  session?: ClientSession,
) {
  if (!blockedId || blockerId === blockedId)
    throw new UserBlockValidationError("자기 자신은 차단할 수 없습니다.");
  if (!(await repository.userExists(blockedId)))
    throw new UserBlockNotFoundError("차단할 사용자를 찾을 수 없습니다.");
  await repository.create(blockerId, blockedId, session);
}

export async function unblockUser(
  repository: UserBlockRepository,
  blockerId: string,
  blockedId: string,
) {
  if (!blockedId)
    throw new UserBlockValidationError("차단 대상을 확인해주세요.");
  await repository.remove(blockerId, blockedId);
}
