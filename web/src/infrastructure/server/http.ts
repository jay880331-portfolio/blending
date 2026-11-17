import { NextResponse } from "next/server";

export type ApiMessage = {
  message: string;
  code?: string;
};

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json<ApiMessage>(
    { message, ...(code ? { code } : {}) },
    { status },
  );
}

export async function readJson<T extends object>(
  request: Request,
): Promise<Partial<T>> {
  try {
    const body = (await request.json()) as unknown;
    return typeof body === "object" && body !== null
      ? (body as Partial<T>)
      : {};
  } catch {
    return {};
  }
}

export function requireString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function compactStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.trim());
}
