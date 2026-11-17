import { loadEnvConfig } from "@next/env";
import { getMongoClient } from "@/infrastructure/mongodb/client";
import { ensureMongoIndexes } from "@/infrastructure/mongodb/indexes";
import { reconcileSearchIndex } from "@/application/admin/searchIndexUseCases";

loadEnvConfig(process.cwd());

async function main() {
  await ensureMongoIndexes();
  const run = await reconcileSearchIndex("script");
  console.log(
    `search_documents reconciled: indexed=${run.indexedCount} deleted=${run.deletedCount}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const client = await Promise.resolve()
      .then(() => getMongoClient())
      .catch(() => null);
    await client?.close();
  });
