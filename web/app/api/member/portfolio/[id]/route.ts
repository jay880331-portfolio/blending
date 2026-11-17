import { type NextRequest, NextResponse } from "next/server";
import type { PortfolioItem } from "@/domain/member/types";
import { getMongoDb, toDomain } from "@/infrastructure/mongodb/client";
import { getCurrentUser } from "@/infrastructure/server/auth";
import {
  compactStrings,
  jsonError,
  readJson,
  requireString,
} from "@/infrastructure/server/http";

type Params = Promise<{ id: string }>;

type PortfolioRequest = {
  title?: string;
  summary?: string;
  imageUrls?: string[];
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await params;
  const body = await readJson<PortfolioRequest>(request);
  const title = requireString(body.title);
  const summary = requireString(body.summary);
  const imageUrls = compactStrings(body.imageUrls);

  if (!title || !summary)
    return jsonError("포트폴리오 제목과 내용을 입력해주세요.");

  const db = await getMongoDb();
  const result = await db
    .collection<PortfolioItem & { ownerId: string }>("member_portfolios")
    .findOneAndUpdate(
      { id, ownerId: user.id },
      { $set: { title, summary, imageUrls } },
      { returnDocument: "after" },
    );

  if (!result) return jsonError("포트폴리오를 찾을 수 없습니다.", 404);
  return NextResponse.json(toDomain(result));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Params },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await params;
  const db = await getMongoDb();
  const result = await db
    .collection<PortfolioItem & { ownerId: string }>("member_portfolios")
    .deleteOne({ id, ownerId: user.id });

  if (result.deletedCount === 0)
    return jsonError("포트폴리오를 찾을 수 없습니다.", 404);
  return NextResponse.json({ success: true });
}
