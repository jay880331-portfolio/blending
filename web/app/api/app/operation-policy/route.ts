import { adminSettingsMongoRepository } from "@/infrastructure/mongodb/adminSettingsMongoRepository";
import { toPublicOperationPolicy } from "@/infrastructure/server/operationPolicy";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    toPublicOperationPolicy(
      await adminSettingsMongoRepository.getOperationPolicy(),
    ),
    { headers: { "Cache-Control": "no-store" } },
  );
}
