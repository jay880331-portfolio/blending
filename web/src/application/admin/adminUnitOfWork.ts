import type {
  AdminAuditListQuery,
  AdminAuditLogDto,
  AdminPage,
  NewAdminAuditLog,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import { getMongoClient } from "@/infrastructure/mongodb/client";

export interface AdminAuditRepository {
  append(input: NewAdminAuditLog, session: ClientSession): Promise<void>;
  list(query: AdminAuditListQuery): Promise<AdminPage<AdminAuditLogDto>>;
  findById(id: string): Promise<AdminAuditLogDto | null>;
}

export interface AdminUnitOfWork {
  run<T>(work: (session: ClientSession) => Promise<T>): Promise<T>;
}

export const adminUnitOfWork: AdminUnitOfWork = {
  async run(work) {
    const client = await getMongoClient();
    const session = client.startSession();

    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  },
};
