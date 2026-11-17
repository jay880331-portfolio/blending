import { type NextRequest } from "next/server";
import { MemberMongoRepository } from "@/infrastructure/mongodb/memberMongoRepository";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const blockedUserIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const repository = new MemberMongoRepository(user.id, blockedUserIds);
  const snapshot = await repository.getSnapshot();

  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
