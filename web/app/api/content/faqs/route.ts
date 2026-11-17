import { NextResponse } from "next/server";
import { listPublicFaqs } from "@/application/admin/guideContentUseCases";
import { AdminGuideContentMongoRepository } from "@/infrastructure/mongodb/adminGuideContentMongoRepository";
export async function GET() {
  return NextResponse.json(
    await listPublicFaqs(new AdminGuideContentMongoRepository(), new Date()),
    { headers: { "Cache-Control": "no-store" } },
  );
}
