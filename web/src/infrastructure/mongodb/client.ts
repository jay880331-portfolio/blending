import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const DEFAULT_DB_NAME = "blending";

type MongoGlobal = typeof globalThis & {
  __blendingMongoClientPromise?: Promise<MongoClient>;
};

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is required.");
  return uri;
}

export function getMongoClient(): Promise<MongoClient> {
  const globalForMongo = globalThis as MongoGlobal;

  if (!globalForMongo.__blendingMongoClientPromise) {
    globalForMongo.__blendingMongoClientPromise = MongoClient.connect(
      getMongoUri(),
      {
        appName: "blending-community",
        maxPoolSize: 10,
        serverApi: {
          version: ServerApiVersion.v1,
          deprecationErrors: true,
        },
      },
    );
  }

  return globalForMongo.__blendingMongoClientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? DEFAULT_DB_NAME);
}

export function toDomain<T extends object>(document: T): T {
  const copy = { ...document } as Record<string, unknown>;
  delete copy._id;
  delete copy._createdAt;
  delete copy._updatedAt;
  delete copy.ownerId;
  return copy as T;
}
