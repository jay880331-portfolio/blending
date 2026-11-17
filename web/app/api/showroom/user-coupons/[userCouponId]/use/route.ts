import { jsonError } from "@/infrastructure/server/http";
export async function POST() {
  return jsonError(
    "고객 쿠폰 QR을 직원에게 보여주세요. 직원이 스캔하고 사용을 확인합니다.",
    410,
  );
}
