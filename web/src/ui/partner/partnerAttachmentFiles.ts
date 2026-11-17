import {
  MAX_UPLOAD_FILE_SIZE,
  UPLOAD_FILE_SIZE_ERROR_MESSAGE,
} from "@/adapters/http/uploadApi";

export const PARTNER_ATTACHMENT_ACCEPT =
  "image/jpeg,image/jpg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf";

export function partnerAttachmentMime(file: File): string {
  if (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "application/pdf"
  ) {
    return file.type;
  }

  if (file.type === "image/jpg" || file.type === "image/pjpeg") {
    return "image/jpeg";
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "pdf") return "application/pdf";
  return file.type;
}

export function normalizePartnerAttachmentFile(file: File): File {
  const type = partnerAttachmentMime(file);
  return type === file.type
    ? file
    : new File([file], file.name, {
        type,
        lastModified: file.lastModified,
      });
}

export function isSupportedPartnerAttachment(file: File) {
  const type = partnerAttachmentMime(file);
  return (
    type === "image/jpeg" || type === "image/png" || type === "application/pdf"
  );
}

export function filterPartnerAttachmentFiles(
  files: File[],
  showToast: (message: string) => void,
) {
  return files.flatMap((file) => {
    const normalized = normalizePartnerAttachmentFile(file);

    if (!isSupportedPartnerAttachment(normalized)) {
      showToast("이미지 또는 PDF 파일만 첨부할 수 있습니다.");
      return [];
    }

    if (normalized.size > MAX_UPLOAD_FILE_SIZE) {
      showToast(UPLOAD_FILE_SIZE_ERROR_MESSAGE);
      return [];
    }

    return [normalized];
  });
}
