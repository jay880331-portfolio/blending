import { type NextRequest, NextResponse } from "next/server";
import {
  UserBlockNotFoundError,
  UserBlockValidationError,
  blockUser,
  unblockUser,
} from "@/application/community/userBlockUseCases";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type BlockRequest = { blockedUserId: string };

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await ensureMongoIndexes();
    const body = await readJson<BlockRequest>(request);
    const blockedUserId = requireString(body.blockedUserId);
    await blockUser(
      new UserBlockMongoRepository(),
      user.id,
      blockedUserId ?? "",
    );
    return NextResponse.json({ blockedUserId }, { status: 201 });
  } catch (error) {
    if (error instanceof UserBlockValidationError)
      return jsonError(error.message, 400);
    if (error instanceof UserBlockNotFoundError)
      return jsonError(error.message, 404);
    return jsonError("사용자를 차단하지 못했습니다.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    const blockedUserId = requireString(
      (await readJson<BlockRequest>(request)).blockedUserId,
    );
    await unblockUser(
      new UserBlockMongoRepository(),
      user.id,
      blockedUserId ?? "",
    );
    return NextResponse.json({ blockedUserId });
  } catch (error) {
    if (error instanceof UserBlockValidationError)
      return jsonError(error.message, 400);
    return jsonError("사용자 차단을 해제하지 못했습니다.", 500);
  }
}
