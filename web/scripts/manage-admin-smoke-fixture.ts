import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";

export const SMOKE_FIXTURE_ID = "admin-smoke-fixture";

export function parseSmokeFixtureAction(args: string[]) {
  const create = args.includes("--create");
  const remove = args.includes("--remove");
  if (create === remove) throw new Error("사용법: --create | --remove");
  return create ? "create" : "remove";
}

export async function manageAdminSmokeFixture(
  action: "create" | "remove",
  log = console.log,
) {
  if (process.env.ADMIN_SMOKE_ENABLED !== "true")
    throw new Error("ADMIN_SMOKE_ENABLED=true is required.");

  const db = await getMongoDb();
  const users = db.collection("users");
  const profiles = db.collection("member_profiles");
  const existing = await users.findOne({ id: SMOKE_FIXTURE_ID });
  if (existing && existing.smokeFixture !== true)
    throw new Error("Refusing to modify an unmarked smoke fixture user.");

  if (action === "create") {
    const now = new Date();
    await users.updateOne(
      { id: SMOKE_FIXTURE_ID, smokeFixture: true },
      {
        $set: { accountStatus: "active", updatedAt: now },
        $setOnInsert: {
          id: SMOKE_FIXTURE_ID,
          name: SMOKE_FIXTURE_ID,
          role: "enthusiast",
          workplaces: [],
          specialties: [],
          socials: { instagram: "", threads: "", website: "", recipeUrl: "" },
          socialAccounts: [],
          createdAt: now,
          smokeFixture: true,
        },
      },
      { upsert: true },
    );
    await profiles.updateOne(
      { ownerId: SMOKE_FIXTURE_ID, smokeFixture: true },
      {
        $setOnInsert: {
          id: SMOKE_FIXTURE_ID,
          ownerId: SMOKE_FIXTURE_ID,
          name: SMOKE_FIXTURE_ID,
          smokeFixture: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    log(`created: ${SMOKE_FIXTURE_ID}`);
    return;
  }

  await Promise.all([
    users.deleteOne({ id: SMOKE_FIXTURE_ID, smokeFixture: true }),
    profiles.deleteOne({ ownerId: SMOKE_FIXTURE_ID, smokeFixture: true }),
  ]);
  log(`removed: ${SMOKE_FIXTURE_ID}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  await manageAdminSmokeFixture(parseSmokeFixtureAction(process.argv.slice(2)));
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
    .finally(async () => (await getMongoClient().catch(() => null))?.close());
}
