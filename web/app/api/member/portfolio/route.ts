import { type NextRequest, NextResponse } from "next/server";
import type { PortfolioItem } from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { createId } from "@/infrastructure/server/content";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";

type PortfolioRequest = {
  title: string;
  summary: string;
  imageUrls?: string[];
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<PortfolioRequest>(request);
  const title = requireString(body.title);
  const summary = requireString(body.summary);
  if (!title || !summary)
    return jsonError("포트폴리오 제목과 내용을 입력해주세요.");
  if (prohibitedPublicContent(title, summary))
    return jsonError(
      PROHIBITED_PUBLIC_CONTENT.message,
      400,
      PROHIBITED_PUBLIC_CONTENT.code,
    );

  const now = new Date();
  const item: PortfolioItem & { ownerId: string } = {
    ownerId: user.id,
    id: createId("portfolio"),
    title,
    createdAt: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`,
    summary,
    imageUrls: compactStrings(body.imageUrls),
  };

  const db = await getMongoDb();
  await db.collection("member_portfolios").insertOne(item);
  return NextResponse.json(toDomain(item), { status: 201 });
}
