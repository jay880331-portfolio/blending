import { NextResponse } from "next/server";
import { listPublicNotices } from "@/application/admin/guideContentUseCases";
import { AdminGuideContentMongoRepository } from "@/infrastructure/mongodb/adminGuideContentMongoRepository";
export async function GET() {
  return NextResponse.json(
    await listPublicNotices(new AdminGuideContentMongoRepository(), new Date()),
    { headers: { "Cache-Control": "no-store" } },
  );
}
