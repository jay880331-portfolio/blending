import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  cancelPassportPresentation,
  createPassportPresentation,
  PassportError,
} from "@/infrastructure/server/passportRepository";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<{
    purpose?: unknown;
    storeId?: unknown;
    menuId?: unknown;
  }>(request);

  if (body.purpose !== "STAMP" && body.purpose !== "REDEEM") {
    return jsonError("여권 QR 목적이 올바르지 않습니다.", 400);
  }

  try {
    const presentation = await createPassportPresentation(user.id, {
      purpose: body.purpose,
      storeId: typeof body.storeId === "string" ? body.storeId : undefined,
      menuId: typeof body.menuId === "string" ? body.menuId : undefined,
    });
    return NextResponse.json(presentation);
  } catch (error) {
    if (error instanceof PassportError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const body = await readJson<{ token?: unknown }>(request);
  if (typeof body.token === "string" && body.token) {
    await cancelPassportPresentation(user.id, body.token);
  }
  return NextResponse.json({ ok: true });
}
