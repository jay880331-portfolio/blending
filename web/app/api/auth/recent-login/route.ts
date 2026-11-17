import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import {
  RECENT_LOGIN_DEVICE_COOKIE,
  recentLoginMethodForDevice,
  setRecentLoginDeviceCookie,
} from "@/infrastructure/server/auth";

export async function GET(request: NextRequest) {
  await ensureMongoIndexes();

  const method = await recentLoginMethodForDevice(request);
  const response = NextResponse.json({ method });

  if (!request.cookies.get(RECENT_LOGIN_DEVICE_COOKIE)?.value) {
    setRecentLoginDeviceCookie(response, randomBytes(16).toString("hex"));
  }

  return response;
}
