import { NextResponse } from "next/server";
const retired = () =>
  NextResponse.json(
    {
      message: "매장 QR 방식은 종료되었습니다. 직원 쿠폰 스캔을 이용해 주세요.",
    },
    { status: 410 },
  );
export const GET = retired;
export const POST = retired;
