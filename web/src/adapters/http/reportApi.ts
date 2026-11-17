import type { CreateReportInput } from "@blending/admin-contracts";
export async function createReport(input: CreateReportInput) {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error ?? body.message ?? "신고를 접수하지 못했습니다.",
    );
  return body;
}
