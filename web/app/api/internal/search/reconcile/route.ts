import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { reconcileSearchIndex } from "@/application/admin/searchIndexUseCases";
import { jsonError } from "@/infrastructure/server/http";

export function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  return (
    Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request))
    return jsonError("권한이 없습니다.", 401);

  await ensureMongoIndexes();
  const run = await reconcileSearchIndex("cron");

  return Response.json({
    ok: true,
    run,
  });
}
