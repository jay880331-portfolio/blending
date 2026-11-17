import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isDailyNoteImageFolder,
  resolveDailyNoteImageUploadFolder,
  shouldRejectDailyNoteUploadKind,
} from "@/domain/daily-note/dailyNoteImageUrl";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError } from "@/infrastructure/server/http";
import {
  privateMemberUploadFolder,
  type PrivateMemberUploadKind,
  uploadImageFiles,
  uploadPartnerAttachments,
  uploadProfileDocuments,
} from "@/infrastructure/server/r2";

const uploadValidationMessages = new Set([
  "업로드할 파일이 없습니다.",
  "이미지는 최대 10개까지 첨부할 수 있습니다.",
  "이미지는 총 60MB 이하로 첨부해 주세요.",
  "JPG, PNG 이미지만 첨부할 수 있습니다.",
  "이미지는 15MB 이하로 첨부해 주세요.",
  "변환된 이미지는 5MB 이하로 첨부해 주세요.",
  "파일은 최대 10개까지 첨부할 수 있습니다.",
  "파일은 총 60MB 이하로 첨부해 주세요.",
  "PDF, JPG, PNG 파일만 첨부할 수 있습니다.",
  "파일은 15MB 이하로 첨부해 주세요.",
  "이미지 또는 PDF 파일만 첨부할 수 있습니다.",
]);

export function privateUploadKind(
  folder: string,
): PrivateMemberUploadKind | null {
  if (folder === "members/avatars") return "profile";
  if (folder === "members/certificates") return "certificates";
  if (folder === "members/portfolio") return "portfolio";
  return null;
}

export type UploadRouteDependencies = {
  getCurrentUser(request: NextRequest): Promise<{ id: string } | null>;
  uploadImageFiles: typeof uploadImageFiles;
  uploadPartnerAttachments: typeof uploadPartnerAttachments;
  uploadProfileDocuments: typeof uploadProfileDocuments;
};

const productionDependencies: UploadRouteDependencies = {
  getCurrentUser,
  uploadImageFiles,
  uploadPartnerAttachments,
  uploadProfileDocuments,
};

export function createUploadRoute(
  dependencies: UploadRouteDependencies = productionDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const user = await dependencies.getCurrentUser(request);
    if (!user) return jsonError("로그인이 필요합니다.", 401);
    try {
      const formData = await request.formData();
      const requestedFolder = String(formData.get("folder") ?? "uploads");
      const kind = String(formData.get("kind") ?? "image");
      if (shouldRejectDailyNoteUploadKind(requestedFolder, kind))
        return jsonError(
          "STORY 이미지는 이미지로만 업로드할 수 있습니다.",
          400,
        );
      const dailyNoteImageUpload = isDailyNoteImageFolder(requestedFolder);
      const privateKind = privateUploadKind(requestedFolder);
      const folder = privateKind
        ? privateMemberUploadFolder(user.id, privateKind)
        : resolveDailyNoteImageUploadFolder(requestedFolder, user.id);
      const files = formData
        .getAll("files")
        .filter((value): value is File => value instanceof File);
      if (files.length === 0) return jsonError("업로드할 파일이 없습니다.");
      const uploaded = dailyNoteImageUpload
        ? await dependencies.uploadImageFiles(files, folder)
        : kind === "profile-document"
          ? await dependencies.uploadProfileDocuments(files, folder)
          : kind === "partner-attachment"
            ? await dependencies.uploadPartnerAttachments(files, folder)
            : await dependencies.uploadImageFiles(files, folder);
      return NextResponse.json({ files: uploaded });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return jsonError(
        uploadValidationMessages.has(message)
          ? message
          : "파일 업로드에 실패했습니다.",
        500,
      );
    }
  };
}

export const uploadRoute = createUploadRoute();
