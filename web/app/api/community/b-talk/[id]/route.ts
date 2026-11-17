import { type NextRequest, NextResponse } from "next/server";
import type { Recipe } from "@/domain/community/types";
import { publicContentFilter } from "@/infrastructure/mongodb/adminContentMongoRepository";
import { isContentOwner } from "@/infrastructure/server/contentOwnership";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import {
  deleteSourceSearchDocument,
  upsertRecipeSearchDocument,
} from "@/infrastructure/mongodb/searchMongoRepository";
import {
  getCurrentAdminUser,
  getCurrentUser,
} from "@/infrastructure/server/auth";
import { requireContentWriteAllowed } from "@/infrastructure/server/sanctions";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import {
  firstOrFallback,
  roastCategoryOrNull,
} from "@/infrastructure/server/content";

type OwnedRecipe = Recipe & { ownerId?: string };

type RouteParams = {
  params: Promise<{ id: string }>;
};

type UpdateRecipeRequest = {
  title: string;
  roast?: Recipe["roast"];
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
  const isAdmin = Boolean(await getCurrentAdminUser(request));

  const { id } = await params;
  const db = await getMongoDb();
  const recipe = await db
    .collection<OwnedRecipe>("community_b_talk")
    .findOne({ $and: [{ id }, publicContentFilter] });

  if (!recipe) return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(recipe, user))
    return jsonError("B-TALK 글을 수정할 권한이 없습니다.", 403);

  const body = await readJson<UpdateRecipeRequest>(request);
  const title = requireString(body.title);
  const note = requireString(body.note);
  const roast = body.roast ? roastCategoryOrNull(body.roast) : recipe.roast;
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
  if (!roast) return jsonError("로스팅 카테고리를 확인해주세요.");
  const processImages = compactStrings(body.processImages).slice(0, 6);
  const coverUrl = processImages[0] ?? body.coverUrl;
  const recipeImages = processImages.length
    ? processImages
    : coverUrl
      ? [coverUrl]
      : [];

  const updatedRecipe: OwnedRecipe = {
    ...recipe,
    title,
    roast,
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
  };

  const result = await db.collection<OwnedRecipe>("community_b_talk").updateOne(
    { $and: [{ id }, publicContentFilter] },
    {
      $set: {
        title: updatedRecipe.title,
        roast: updatedRecipe.roast,
        coverUrl: updatedRecipe.coverUrl,
        processImages: updatedRecipe.processImages,
        bean: updatedRecipe.bean,
        extraction: updatedRecipe.extraction,
        note: updatedRecipe.note,
      },
    },
  );
  if (result.matchedCount === 0)
    return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);
  await upsertRecipeSearchDocument(updatedRecipe);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
  const isAdmin = Boolean(await getCurrentAdminUser(request));

  const { id } = await params;
  const db = await getMongoDb();
  const recipe = await db
    .collection<OwnedRecipe>("community_b_talk")
    .findOne({ $and: [{ id }, publicContentFilter] });

  if (!recipe) return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);
  if (!isAdmin && !isOwner(recipe, user))
    return jsonError("B-TALK 글을 삭제할 권한이 없습니다.", 403);

  const result = await db
    .collection<OwnedRecipe>("community_b_talk")
    .deleteOne({ $and: [{ id }, publicContentFilter] });
  if (result.deletedCount === 0)
    return jsonError("B-TALK 글을 찾을 수 없습니다.", 404);
  await deleteSourceSearchDocument("community_b_talk", id);
  await db.collection("content_likes").deleteMany({
    targetType: "community_b_talk",
    targetId: id,
  });
  await db.collection("member_activities").deleteMany({
    href: `/community/b-talk/${id}`,
  });

  return NextResponse.json({ success: true });
}

function isOwner(
  item: Pick<OwnedRecipe, "ownerId" | "author">,
  currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
) {
  return isContentOwner(item.ownerId, currentUser.id);
}
