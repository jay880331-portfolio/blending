import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  isValidNoticeExpiryOption,
  validateStatusNoticeText,
  type ShowroomNoticeExpiryOption,
} from "@/domain/showroom/statusNotice";
import {
  clearShowroomStatusNotice,
  ForbiddenError,
  NotFoundError,
  updateShowroomStatusNotice,
} from "@/infrastructure/server/showroomRepository";

type NoticeBody = {
  text?: unknown;
  expiryOption?: unknown;
};

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  const body = await readJson<NoticeBody>(request);
  const textRaw = typeof body.text === "string" ? body.text : "";
  const validated = validateStatusNoticeText(textRaw);
  if (!validated.ok) {
    return jsonError(validated.error, 400);
  }

  if (
    body.expiryOption !== undefined &&
    !isValidNoticeExpiryOption(body.expiryOption)
  ) {
    return jsonError("만료 옵션이 올바르지 않습니다.", 400);
  }

  const expiryOption: ShowroomNoticeExpiryOption =
    body.expiryOption === undefined ? "today_end" : body.expiryOption;

  try {
    const statusNotice = await updateShowroomStatusNotice({
      userId: user.id,
      storeId: id,
      text: validated.text,
      expiryOption,
    });
    return NextResponse.json({ statusNotice });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError(error.message, 404);
    if (error instanceof ForbiddenError) return jsonError(error.message, 403);
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError("로그인이 필요합니다.", 401);

  const { id } = await context.params;
  try {
    await clearShowroomStatusNotice({ userId: user.id, storeId: id });
    return NextResponse.json({ cleared: true });
  } catch (error) {
    if (error instanceof NotFoundError) return jsonError(error.message, 404);
    if (error instanceof ForbiddenError) return jsonError(error.message, 403);
    throw error;
  }
}
