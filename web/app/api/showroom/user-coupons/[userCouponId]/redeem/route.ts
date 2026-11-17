import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json(
    {
      message:
        "고객 쿠폰 QR을 직원에게 보여주세요. 매장 QR 사용 방식은 종료되었습니다.",
    },
    { status: 410 },
  );
}
