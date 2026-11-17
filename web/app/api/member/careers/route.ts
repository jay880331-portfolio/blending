import { type NextRequest, NextResponse } from "next/server";
import type { CareerItem } from "@/domain/member/types";
import { validateCareerDrafts } from "@/domain/member/careerValidation";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";

type CareersRequest = {
  items: CareerItem[];
};

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<CareersRequest>(request);
  const items = Array.isArray(body.items) ? body.items : [];
  const validationMessage = validateCareerDrafts(items);
  if (validationMessage) return jsonError(validationMessage, 400);
  const normalizedItems = items.map((item) => ({
    ...item,
    year: item.year.trim(),
    period: item.period.trim(),
    title: item.title.trim(),
    organization: item.organization?.trim(),
    detail: item.detail?.trim(),
    description: item.description?.trim(),
  }));

  const db = await getMongoDb();
  const careers = db.collection("member_careers");

  await careers.deleteMany({ ownerId: user.id });
  if (normalizedItems.length > 0) {
    await careers.insertMany(
      normalizedItems.map((item) => ({ ...item, ownerId: user.id })),
    );
  }

  return NextResponse.json({ success: true });
}
