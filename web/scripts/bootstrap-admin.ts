import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { adminUnitOfWork } from "@/application/admin/adminUnitOfWork";
import { runAuditedMutation } from "@/application/admin/auditedMutation";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import { adminAuditMongoRepository } from "@/infrastructure/mongodb/adminAuditMongoRepository";
import { AdminUserMongoRepository } from "@/infrastructure/mongodb/adminUserMongoRepository";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import type { UserDocument } from "@/infrastructure/server/auth";

type BootstrapOptions = { phone: string; apply: boolean };
type BootstrapUser = Pick<UserDocument, "id" | "name" | "role">;
type BootstrapDependencies = {
  findUsers(phone: string): Promise<BootstrapUser[]>;
  prepareApply(): Promise<void>;
  applyRole(user: BootstrapUser): Promise<void>;
  log(message: string): void;
};

export function parseBootstrapArgs(args: string[]): BootstrapOptions {
  const phoneIndex = args.indexOf("--phone");
  const phone = phoneIndex >= 0 ? args[phoneIndex + 1]?.replace(/\D/g, "") : "";
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run");
  if (!phone || phone.length < 10 || apply === dryRun)
    throw new Error("사용법: --phone <번호> (--dry-run | --apply)");
  return { phone, apply };
}

export async function bootstrapAdmin(
  { phone, apply }: BootstrapOptions,
  dependencies: BootstrapDependencies = defaultDependencies,
) {
  const matches = await dependencies.findUsers(phone);
  if (matches.length !== 1)
    throw new Error(
      `대상 계정이 ${matches.length}개입니다. 변경하지 않았습니다.`,
    );

  const user = matches[0];
  if (user.role === "admin") {
    dependencies.log(`already admin: ${user.id} ${user.name}`);
    return;
  }
  if (!apply) {
    dependencies.log(`dry-run: ${user.id} ${user.name} ${user.role} -> admin`);
    return;
  }

  await dependencies.prepareApply();
  await dependencies.applyRole(user);
  dependencies.log(`admin applied: ${user.id} ${user.name}`);
}

const defaultDependencies: BootstrapDependencies = {
  async findUsers(phone) {
    const db = await getMongoDb();
    return db
      .collection<UserDocument>("users")
      .find({ phone })
      .project<BootstrapUser>({ _id: 0, id: 1, name: 1, role: 1 })
      .limit(2)
      .toArray();
  },
  prepareApply: ensureMongoIndexes,
  async applyRole(user) {
    const repository = new AdminUserMongoRepository();
    await runAuditedMutation(
      adminUnitOfWork,
      adminAuditMongoRepository,
      {
        actorId: null,
        actorName: "bootstrap-admin",
        action: "user.role_change",
        resourceType: "user",
        resourceId: user.id,
        reason: "initial admin bootstrap",
        changedFields: ["role"],
        requestId: crypto.randomUUID(),
        ip: "local-cli",
        userAgent: "bootstrap-admin",
      },
      (session) => repository.updateRole(user.id, "admin", session),
    );
  },
  log: console.log,
};

async function main() {
  loadEnvConfig(process.cwd());
  await bootstrapAdmin(parseBootstrapArgs(process.argv.slice(2)));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const client = await getMongoClient().catch(() => null);
      await client?.close();
    });
}
