import { type NextRequest, NextResponse } from "next/server";
import {
  createAppleNativeChallenge,
  setAppleNativeChallengeCookie,
} from "@/infrastructure/server/oauth";

export async function GET(_request: NextRequest) {
  const challenge = createAppleNativeChallenge();
  const response = NextResponse.json(challenge);
  setAppleNativeChallengeCookie(response, challenge);
  return response;
}
