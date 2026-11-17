import type { NextRequest } from "next/server";
import { retryAdminAccountDeletionJob } from "@/infrastructure/server/adminAccountDeletionJobRoutes";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  return retryAdminAccountDeletionJob(request, (await params).id);
}
