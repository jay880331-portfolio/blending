import { type NextRequest, NextResponse } from "next/server";
import {
  canWriteTalkAudience,
  defaultTalkAudienceForRole,
  type TalkAudience,
} from "@/domain/community/talkAudience";
import type { Recipe, RoastCategory } from "@/domain/community/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { upsertRecipeSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import {
  createId,
  firstOrFallback,
  nowIso,
  roastCategoryOrNull,
} from "@/infrastructure/server/content";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";

type CreateRecipeRequest = {
  audience?: TalkAudience;
  title: string;
  roast?: RoastCategory;
  authorName?: string;
  authorHandle?: string;
  coverUrl?: string;
  processImages?: string[];
  origin?: string;
  process?: string;
  roastPoint?: string;
  dosing?: string;
  yield?: string;
  time?: string;
  temp?: string;
  note: string;
};

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
  const body = await readJson<CreateRecipeRequest>(request);
  const audience: TalkAudience =
    body.audience === "enthusiast" || body.audience === "barista"
      ? body.audience
      : defaultTalkAudienceForRole(user.role);
  if (!canWriteTalkAudience(user.role, audience)) {
    return jsonError("해당 토크 게시판에 글을 작성할 권한이 없습니다.", 403);
  }
  const title = requireString(body.title);
  const note = requireString(body.note);
  if (!title || !note) return jsonError("B-TALK 제목과 내용을 입력해주세요.");
  if (
    prohibitedPublicContent(
      title,
      note,
      body.origin,
      body.process,
      body.roastPoint,
      body.dosing,
      body.yield,
      body.time,
      body.temp,
    )
  )
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );
  const roast = body.roast ? roastCategoryOrNull(body.roast) : "medium";
  if (!roast) return jsonError("로스팅 카테고리를 확인해주세요.");
  const processImages = compactStrings(body.processImages).slice(0, 6);
  const coverUrl = processImages[0] ?? body.coverUrl;
  const recipeImages = processImages.length
    ? processImages
    : coverUrl
      ? [coverUrl]
      : [];

  const recipe: Recipe = {
    id: createId("b-talk"),
    audience,
    title,
    roast,
    author: {
      name: firstOrFallback(user?.handle ?? body.authorName, "익명"),
      handle: firstOrFallback(user?.handle ?? body.authorHandle, "anonymous"),
    },
    createdAt: nowIso(),
    likes: 0,
    liked: false,
    viewCount: 0,
    coverUrl,
    processImages: recipeImages,
    bean: {
      origin: firstOrFallback(body.origin, "미입력"),
      process: firstOrFallback(body.process, "미입력"),
      roastPoint: firstOrFallback(body.roastPoint, "미입력"),
    },
    extraction: {
      dosing: firstOrFallback(body.dosing, "0g"),
      yield: firstOrFallback(body.yield, "0g"),
      time: firstOrFallback(body.time, "0s"),
      temp: firstOrFallback(body.temp, "0°C"),
    },
    note,
    commentCount: 0,
    comments: [],
  };
  const ownedRecipe = user ? { ...recipe, ownerId: user.id } : recipe;

  const db = await getMongoDb();
  await db
    .collection<typeof ownedRecipe>("community_b_talk")
    .insertOne(ownedRecipe);
  await upsertRecipeSearchDocument(recipe);

  return NextResponse.json(
    { ...toDomain(ownedRecipe), isOwner: Boolean(user) },
    { status: 201 },
  );
}
