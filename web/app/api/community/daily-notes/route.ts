import { type NextRequest, NextResponse } from "next/server";
import {
  decodeDailyNoteCursor,
  type DailyNote,
  type DailyNoteInput,
} from "@/domain/daily-note/dailyNote";
import { validateDailyNoteCreateRequest } from "@/application/daily-note/dailyNoteCreateRequest";
import { DailyNoteMongoRepository } from "@/infrastructure/mongodb/dailyNoteMongoRepository";
import { UserBlockMongoRepository } from "@/infrastructure/mongodb/userBlockMongoRepository";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { createId, nowIso } from "@/infrastructure/server/content";
import { jsonError, readJson } from "@/infrastructure/server/http";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const requestedLimit = Number(
    request.nextUrl.searchParams.get("limit") ?? 30,
  );
  if (
    !Number.isInteger(requestedLimit) ||
    requestedLimit < 1 ||
    requestedLimit > 30
  )
    return jsonError("조회 개수를 확인해주세요.");
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  const cursor = decodeDailyNoteCursor(rawCursor);
  if (rawCursor && !cursor) return jsonError("커서를 확인해주세요.");

  const blockedOwnerIds = await new UserBlockMongoRepository().blockedUserIds(
    user.id,
  );
  const repository = new DailyNoteMongoRepository();
  const mine = request.nextUrl.searchParams.get("mine") === "1";
  const picked = request.nextUrl.searchParams.get("picked") === "1";
  if (mine && picked) return jsonError("조회 조건을 확인해주세요.");
  const options = { cursor, limit: requestedLimit, blockedOwnerIds };
  const result = picked
    ? await repository.listPicked({ ...options, userId: user.id })
    : await repository.list({
        ...options,
        ...(mine ? { ownerId: user.id } : {}),
      });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);
  try {
    await requireContentWriteAllowed(user.id);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "작성할 수 없습니다.",
      403,
    );
  }

  const body = await readJson<DailyNoteInput>(request);
  const validated = validateDailyNoteCreateRequest(body, user.id);
  if (typeof validated === "string") return jsonError(validated);
  const { imageUrls, technicals, featuredTechnicalKeys, note } = validated;

  const location = body.location as DailyNote["location"] | undefined;
  const created: DailyNote & { ownerId: string } = {
    id: createId("daily-note"),
    author: {
      id: user.id,
      nickname: user.handle ?? user.name,
      avatarUrl: user.avatarUrl,
      affiliation: user.workplaces[0],
      isBarista: user.role === "barista",
    },
    imageUrls,
    ...(note ? { note } : {}),
    ...(location
      ? {
          location: {
            name: location.name.trim(),
            address: location.address.trim(),
          },
        }
      : {}),
    technicals,
    featuredTechnicalKeys,
    liked: false,
    likeCount: 0,
    commentCount: 0,
    comments: [],
    createdAt: nowIso(),
    ownerId: user.id,
  };
  const dailyNote = await new DailyNoteMongoRepository().create(created);
  return NextResponse.json(dailyNote, { status: 201 });
}
