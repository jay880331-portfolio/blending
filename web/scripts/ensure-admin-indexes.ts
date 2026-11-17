import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";

async function indexNames() {
  const db = await getMongoDb();
  const collections = await db
    .listCollections({ type: "collection" }, { nameOnly: true })
    .toArray();
  const names = new Set<string>();
  for (const { name } of collections) {
    for (const index of await db.collection(name).listIndexes().toArray())
      if (index.name !== "_id_") names.add(`${name}.${index.name}`);
  }
  return names;
}

export async function ensureAdminIndexes(log = console.log) {
  const before = await indexNames();
  await ensureMongoIndexes();
  const after = await indexNames();
  for (const name of [...after].sort())
    log(`${before.has(name) ? "existing" : "created"}: ${name}`);
}

async function main() {
  loadEnvConfig(process.cwd());
  await ensureAdminIndexes();
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
