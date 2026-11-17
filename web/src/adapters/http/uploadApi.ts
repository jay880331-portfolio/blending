"use client";

import axios from "axios";

export type UploadedFile = {
  key: string;
  url: string;
  name: string;
  size: number;
  contentType: string;
};

type UploadResponse = {
  files: UploadedFile[];
};

export const MAX_UPLOAD_IMAGE_SIZE = 8 * 1024 * 1024;
export const UPLOAD_IMAGE_SIZE_ERROR_MESSAGE =
  "이미지 용량이 큽니다. 8MB 이하 이미지로 다시 첨부해주세요.";
export const MAX_UPLOAD_FILE_SIZE = 15 * 1024 * 1024;
export const UPLOAD_FILE_SIZE_ERROR_MESSAGE =
  "파일 용량이 큽니다. 15MB 이하 파일로 다시 첨부해주세요.";

export function batchUploadFiles<T>(files: T[]): T[][] {
  return files.map((file) => [file]);
}

function assertUploadableImages(files: File[]) {
  files.forEach((file) => {
    if (file.size > MAX_UPLOAD_IMAGE_SIZE)
      throw new Error(UPLOAD_IMAGE_SIZE_ERROR_MESSAGE);
  });
}

function assertUploadableFiles(files: File[]) {
  files.forEach((file) => {
    if (file.size > MAX_UPLOAD_FILE_SIZE)
      throw new Error(UPLOAD_FILE_SIZE_ERROR_MESSAGE);
  });
}

export function uploadErrorMessage(
  error: unknown,
  fallback: string,
  payloadTooLargeMessage = UPLOAD_IMAGE_SIZE_ERROR_MESSAGE,
) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 413) return payloadTooLargeMessage;

    const message = (error.response?.data as { message?: unknown } | undefined)
      ?.message;
    return typeof message === "string" ? message : fallback;
  }

  return error instanceof Error ? error.message : fallback;
}

export async function uploadImages(
  files: File[],
  folder: string,
): Promise<string[]> {
  if (files.length === 0) return [];

  assertUploadableImages(files);

  const uploadedUrls: string[] = [];

  for (const batch of batchUploadFiles(files)) {
    const formData = new FormData();
    formData.set("folder", folder);
    batch.forEach((file) => formData.append("files", file));

    try {
      const response = await axios.post<UploadResponse>(
        "/api/uploads",
        formData,
      );
      uploadedUrls.push(...response.data.files.map((file) => file.url));
    } catch (error) {
      throw new Error(
        uploadErrorMessage(
          error,
          "파일 업로드에 실패했습니다.",
          UPLOAD_IMAGE_SIZE_ERROR_MESSAGE,
        ),
      );
    }
  }

  return uploadedUrls;
}

export async function uploadProfileDocuments(
  files: File[],
  folder: string,
): Promise<string[]> {
  if (files.length === 0) return [];

  const formData = new FormData();
  formData.set("folder", folder);
  formData.set("kind", "profile-document");
  files.forEach((file) => formData.append("files", file));

  const response = await axios.post<UploadResponse>("/api/uploads", formData);
  return response.data.files.map((file) => file.url);
}

export async function uploadPartnerAttachments(
  files: File[],
  folder: string,
): Promise<UploadedFile[]> {
  if (files.length === 0) return [];

  assertUploadableFiles(files);

  const uploadedFiles: UploadedFile[] = [];

  for (const batch of batchUploadFiles(files)) {
    const formData = new FormData();
    formData.set("folder", folder);
    formData.set("kind", "partner-attachment");
    batch.forEach((file) => formData.append("files", file));

    try {
      const response = await axios.post<UploadResponse>(
        "/api/uploads",
        formData,
      );
      uploadedFiles.push(...response.data.files);
    } catch (error) {
      throw new Error(
        uploadErrorMessage(
          error,
          "파일 업로드에 실패했습니다.",
          UPLOAD_FILE_SIZE_ERROR_MESSAGE,
        ),
      );
    }
  }

  return uploadedFiles;
}
