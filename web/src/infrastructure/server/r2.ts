import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { prepareImageForUpload } from "@/infrastructure/server/imageProcessing";

type UploadedFile = {
  key: string;
  url: string;
  name: string;
  size: number;
  contentType: string;
};

const MAX_SOURCE_FILE_SIZE = 15 * 1024 * 1024;
const MAX_OUTPUT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_COUNT = 10;
const MAX_TOTAL_SOURCE_SIZE = 60 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png"]);
const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const allowedPartnerAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function getR2Endpoint() {
  if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
  if (process.env.R2_ACCOUNT_ID)
    return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  throw new Error(
    "R2_ENDPOINT or R2_ACCOUNT_ID environment variable is required.",
  );
}

function getR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey)
    throw new Error("R2 credentials are not configured.");

  return new S3Client({
    endpoint: getR2Endpoint(),
    forcePathStyle: true,
    region: "auto",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function publicUrlFor(key: string) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!baseUrl)
    throw new Error("R2_PUBLIC_BASE_URL environment variable is required.");
  return `${baseUrl.replace(/\/$/, "")}/${key}`;
}

export function r2ObjectKeysFromPublicUrls(
  urls: string[],
  publicBaseUrl: string,
): string[] {
  let baseUrl: URL;
  try {
    baseUrl = new URL(publicBaseUrl);
  } catch {
    return [];
  }

  const basePathname = baseUrl.pathname.replace(/\/+$/, "");
  const prefix = basePathname ? `${basePathname}/` : "/";
  const keys = new Set<string>();

  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.origin !== baseUrl.origin || !url.pathname.startsWith(prefix))
        continue;
      const key = url.pathname.slice(prefix.length);
      if (key) keys.add(key);
    } catch {
      continue;
    }
  }

  return [...keys];
}

type DeleteOwnedUploadUrlsOptions = {
  bucket?: string;
  publicBaseUrl?: string;
  send?: (
    command: DeleteObjectsCommand,
  ) => Promise<{ Errors?: readonly unknown[] }>;
};

export type PrivateMemberUploadKind = "profile" | "certificates" | "portfolio";

type R2ListPage = {
  Contents?: readonly { Key?: string }[];
  IsTruncated?: boolean;
  NextContinuationToken?: string;
};

export type R2PrefixDependencies = {
  bucket?: string;
  list?: (command: ListObjectsV2Command) => Promise<R2ListPage>;
  send?: (
    command: DeleteObjectsCommand,
  ) => Promise<{ Errors?: readonly unknown[] }>;
};

function privateMemberUploadPrefix(userId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(userId))
    throw new Error("Invalid member upload user ID.");
  return `members/${userId}/private/`;
}

export function privateMemberUploadFolder(
  userId: string,
  kind: PrivateMemberUploadKind,
): string {
  return `${privateMemberUploadPrefix(userId)}${kind}`;
}

export async function deletePrivateMemberUploadPrefix(
  userId: string,
  dependencies: R2PrefixDependencies = {},
): Promise<number> {
  const bucket = dependencies.bucket ?? process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2 deletion configuration is required.");

  const client = dependencies.list && dependencies.send ? null : getR2Client();
  const list =
    dependencies.list ??
    ((command: ListObjectsV2Command) => client!.send(command));
  const send =
    dependencies.send ??
    ((command: DeleteObjectsCommand) => client!.send(command));
  const prefix = privateMemberUploadPrefix(userId);
  const keys: string[] = [];
  const seenContinuationTokens = new Set<string>();
  let continuationToken: string | undefined;

  while (true) {
    const page = await list(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key?.startsWith(prefix)) keys.push(object.Key);
    }
    if (!page.IsTruncated) break;

    continuationToken = page.NextContinuationToken;
    if (!continuationToken || seenContinuationTokens.has(continuationToken))
      throw new Error("R2 object listing failed.");
    seenContinuationTokens.add(continuationToken);
  }

  for (let index = 0; index < keys.length; index += 1_000) {
    const result = await send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.slice(index, index + 1_000).map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    if (result.Errors?.length) throw new Error("R2 object deletion failed.");
  }

  return keys.length;
}

export async function deleteOwnedUploadUrls(
  urls: string[],
  options: DeleteOwnedUploadUrlsOptions = {},
): Promise<void> {
  if (urls.length === 0) return;
  const publicBaseUrl = options.publicBaseUrl ?? process.env.R2_PUBLIC_BASE_URL;
  const bucket = options.bucket ?? process.env.R2_BUCKET;
  if (!publicBaseUrl || !bucket)
    throw new Error("R2 deletion configuration is required.");

  const keys = r2ObjectKeysFromPublicUrls(urls, publicBaseUrl);
  if (keys.length === 0) return;

  const client = options.send ? null : getR2Client();
  for (let index = 0; index < keys.length; index += 1_000) {
    const result = await (options.send ?? ((command) => client!.send(command)))(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.slice(index, index + 1_000).map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    if (result.Errors?.length) throw new Error("R2 object deletion failed.");
  }
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

function safeFolderName(folder: string) {
  return (
    folder.replace(/[^a-zA-Z0-9/_-]/g, "-").replace(/^\/+|\/+$/g, "") ||
    "uploads"
  );
}

export async function uploadImageFiles(
  files: File[],
  folder = "uploads",
): Promise<UploadedFile[]> {
  if (files.length > MAX_FILE_COUNT)
    throw new Error("이미지는 최대 10개까지 첨부할 수 있습니다.");
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SOURCE_SIZE)
    throw new Error("이미지는 총 60MB 이하로 첨부해 주세요.");

  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET environment variable is required.");

  const client = getR2Client();
  const safeFolder = safeFolderName(folder);

  return Promise.all(
    files.map(async (file) => {
      if (!allowedTypes.has(file.type))
        throw new Error("JPG, PNG 이미지만 첨부할 수 있습니다.");
      if (file.size > MAX_SOURCE_FILE_SIZE)
        throw new Error("이미지는 15MB 이하로 첨부해 주세요.");

      const image = await prepareImageForUpload(file);
      if (image.size > MAX_OUTPUT_FILE_SIZE)
        throw new Error("변환된 이미지는 5MB 이하로 첨부해 주세요.");

      const key = `${safeFolder}/${Date.now()}-${randomBytes(8).toString("hex")}-${safeFileName(image.name)}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: image.buffer,
          ContentType: image.contentType,
        }),
      );

      return {
        key,
        url: publicUrlFor(key),
        name: image.name,
        size: image.size,
        contentType: image.contentType,
      };
    }),
  );
}

export async function uploadProfileDocuments(
  files: File[],
  folder = "uploads",
): Promise<UploadedFile[]> {
  if (files.length > MAX_FILE_COUNT)
    throw new Error("파일은 최대 10개까지 첨부할 수 있습니다.");
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SOURCE_SIZE)
    throw new Error("파일은 총 60MB 이하로 첨부해 주세요.");

  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET environment variable is required.");

  const client = getR2Client();
  const safeFolder = safeFolderName(folder);

  return Promise.all(
    files.map(async (file) => {
      if (!allowedDocumentTypes.has(file.type))
        throw new Error("PDF, JPG, PNG 파일만 첨부할 수 있습니다.");
      if (file.size > MAX_SOURCE_FILE_SIZE)
        throw new Error("파일은 15MB 이하로 첨부해 주세요.");

      const buffer = Buffer.from(await file.arrayBuffer());
      const key = `${safeFolder}/${Date.now()}-${randomBytes(8).toString("hex")}-${safeFileName(file.name)}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        }),
      );

      return {
        key,
        url: publicUrlFor(key),
        name: file.name,
        size: file.size,
        contentType: file.type,
      };
    }),
  );
}

export async function uploadPartnerAttachments(
  files: File[],
  folder = "uploads",
): Promise<UploadedFile[]> {
  if (files.length > MAX_FILE_COUNT)
    throw new Error("파일은 최대 10개까지 첨부할 수 있습니다.");
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SOURCE_SIZE)
    throw new Error("파일은 총 60MB 이하로 첨부해 주세요.");

  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET environment variable is required.");

  const client = getR2Client();
  const safeFolder = safeFolderName(folder);

  return Promise.all(
    files.map(async (file) => {
      if (!allowedPartnerAttachmentTypes.has(file.type))
        throw new Error("이미지 또는 PDF 파일만 첨부할 수 있습니다.");
      if (file.size > MAX_SOURCE_FILE_SIZE)
        throw new Error("파일은 15MB 이하로 첨부해 주세요.");

      const isPdf = file.type === "application/pdf";
      const uploadedFile = isPdf
        ? {
            buffer: Buffer.from(await file.arrayBuffer()),
            name: file.name,
            size: file.size,
            contentType: file.type,
          }
        : await prepareImageForUpload(file);

      if (!isPdf && uploadedFile.size > MAX_OUTPUT_FILE_SIZE)
        throw new Error("변환된 이미지는 5MB 이하로 첨부해 주세요.");

      const key = `${safeFolder}/${Date.now()}-${randomBytes(8).toString("hex")}-${safeFileName(uploadedFile.name)}`;

      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: uploadedFile.buffer,
          ContentType: uploadedFile.contentType,
        }),
      );

      return {
        key,
        url: publicUrlFor(key),
        name: uploadedFile.name,
        size: uploadedFile.size,
        contentType: uploadedFile.contentType,
      };
    }),
  );
}
