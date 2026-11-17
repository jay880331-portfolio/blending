import {
  ADMIN_BUSINESS_VERIFICATION_STATUSES,
  type AdminBusinessVerificationItem,
  type AdminBusinessVerificationStatus,
} from "@blending/admin-contracts";
import { NextResponse, type NextRequest } from "next/server";
import type { BaristaShowroom } from "@/domain/showroom/types";
import { getMongoDb } from "@/infrastructure/mongodb/client";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiRequest(request);
  if (auth instanceof NextResponse) return auth;

  const statusParam = request.nextUrl.searchParams.get("status");
  if (
    statusParam &&
    !ADMIN_BUSINESS_VERIFICATION_STATUSES.includes(
      statusParam as AdminBusinessVerificationStatus,
    )
  ) {
    return adminError(
      "INVALID_INPUT",
      "유효한 인증 상태 필터가 아닙니다.",
      400,
      adminRequestId(request),
    );
  }

  const db = await getMongoDb();
  const filter: Record<string, unknown> = {
    "businessVerification.number": { $exists: true },
  };
  if (statusParam) {
    filter["businessVerification.status"] = statusParam;
  }

  const showrooms = await db
    .collection<BaristaShowroom>("barista_showrooms")
    .find(filter)
    .sort({ "businessVerification.submittedAt": -1 })
    .limit(100)
    .toArray();

  const ownerIds = Array.from(new Set(showrooms.map((s) => s.userId)));
  const owners = ownerIds.length
    ? await db
        .collection<{ id: string; name?: string }>("users")
        .find({ id: { $in: ownerIds } }, { projection: { id: 1, name: 1 } })
        .toArray()
    : [];
  const ownerNameMap = new Map(owners.map((o) => [o.id, o.name || "회원"]));

  const items: AdminBusinessVerificationItem[] = showrooms
    .filter((s) => Boolean(s.businessVerification))
    .map((s) => ({
      storeId: s.id,
      storeName: s.storeName,
      ownerId: s.userId,
      ownerName: ownerNameMap.get(s.userId) ?? s.baristaName ?? "회원",
      businessNumber: s.businessVerification!.number,
      status: s.businessVerification!.status,
      submittedAt: s.businessVerification!.submittedAt,
      ...(s.businessVerification!.reviewedAt
        ? { reviewedAt: s.businessVerification!.reviewedAt }
        : {}),
      ...(s.businessVerification!.reviewedBy
        ? { reviewedBy: s.businessVerification!.reviewedBy }
        : {}),
      ...(s.businessVerification!.rejectReason
        ? { rejectReason: s.businessVerification!.rejectReason }
        : {}),
    }));

  return adminJson({ items, total: items.length });
}
