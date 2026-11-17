import type { NextRequest } from "next/server";
import {
  AdminContentUseCaseNotFoundError,
  AdminContentValidationError,
} from "./contentUseCases";
import {
  AdminContentConflictError,
  AdminContentInputError,
  AdminContentNotFoundError,
} from "@/infrastructure/mongodb/adminContentMongoRepository";
import { adminError } from "@/infrastructure/server/adminHttp";
import { adminRequestId } from "@/infrastructure/server/adminRequest";

export function adminContentError(request: NextRequest, error: unknown) {
  if (
    error instanceof AdminContentInputError ||
    error instanceof AdminContentValidationError
  )
    return adminError(
      "INVALID_INPUT",
      error.message,
      400,
      adminRequestId(request),
    );
  if (
    error instanceof AdminContentNotFoundError ||
    error instanceof AdminContentUseCaseNotFoundError
  )
    return adminError(
      "NOT_FOUND",
      "콘텐츠를 찾을 수 없습니다.",
      404,
      adminRequestId(request),
    );
  if (error instanceof AdminContentConflictError)
    return adminError(
      "CONFLICT",
      "콘텐츠 상태가 변경되었습니다.",
      409,
      adminRequestId(request),
    );
  return adminError(
    "INTERNAL_ERROR",
    "콘텐츠 요청을 처리하지 못했습니다.",
    500,
    adminRequestId(request),
  );
}
