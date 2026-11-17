import { NextResponse } from "next/server";
import { AdminGuideContentMongoRepository } from "@/infrastructure/mongodb/adminGuideContentMongoRepository";
type Context = { params: Promise<{ slug: string }> };
export async function GET(_request: Request, { params }: Context) {
  const result = await new AdminGuideContentMongoRepository().findPublicPolicy(
    (await params).slug,
    new Date(),
  );
  return result
    ? NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json(
        { message: "정책을 찾을 수 없습니다." },
        { status: 404 },
      );
}
