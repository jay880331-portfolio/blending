import { NextResponse, type NextRequest } from "next/server";
import { adminError, adminJson } from "@/infrastructure/server/adminHttp";
import {
  adminRequestId,
  requireAdminApiRequest,
} from "@/infrastructure/server/adminRequest";
import {
  uploadImageFiles,
  uploadPartnerAttachments,
} from "@/infrastructure/server/r2";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiRequest(request, {
    mutation: true,
    contentType: "multipart",
  });
  if (auth instanceof NextResponse) return auth;
  try {
    const formData = await request.formData();
    const kind = String(formData.get("kind") ?? "image");
    if (kind !== "image" && kind !== "partner-attachment")
      return adminError(
        "INVALID_INPUT",
        "업로드 종류를 확인해주세요.",
        400,
        adminRequestId(request),
      );
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    if (files.length === 0)
      return adminError(
        "INVALID_INPUT",
        "업로드할 파일이 없습니다.",
        400,
        adminRequestId(request),
      );
    const folder = `admin/${kind}`;
    const uploaded =
      kind === "partner-attachment"
        ? await uploadPartnerAttachments(files, folder)
        : await uploadImageFiles(files, folder);
    return adminJson({ files: uploaded });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "파일 업로드에 실패했습니다.";
    const invalid = /최대|이하|JPG|PNG|PDF|첨부/.test(message);
    return adminError(
      invalid ? "INVALID_INPUT" : "INTERNAL_ERROR",
      invalid ? message : "파일 업로드에 실패했습니다.",
      invalid ? 400 : 500,
      adminRequestId(request),
    );
  }
}
