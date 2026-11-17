import { createHmac } from "node:crypto";
import type { Collection } from "mongodb";
import { getMongoDb } from "@/infrastructure/mongodb/client";

const FAILURE_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1_000;

type AdminLoginAttempt = {
  key: string;
  failures: number;
  expiresAt: Date;
};

type RequestWithRuntimeIp = Request & { readonly ip?: unknown };

export type AdminLoginAttemptStore = {
  find(key: string): Promise<AdminLoginAttempt | null>;
  increment(key: string, now: Date, expiresAt: Date): Promise<void>;
  clear(key: string): Promise<void>;
};

async function attemptsCollection(): Promise<Collection<AdminLoginAttempt>> {
  const db = await getMongoDb();
  return db.collection<AdminLoginAttempt>("admin_login_attempts");
}

const mongoAttemptStore: AdminLoginAttemptStore = {
  async find(key) {
    const collection = await attemptsCollection();
    return collection.findOne({ key });
  },
  async increment(key, now, expiresAt) {
    const collection = await attemptsCollection();
    await collection.updateOne(
      { key },
      [
        {
          $set: {
            failures: {
              $cond: [
                { $gt: ["$expiresAt", now] },
                { $add: [{ $ifNull: ["$failures", 0] }, 1] },
                1,
              ],
            },
            expiresAt: {
              $cond: [{ $gt: ["$expiresAt", now] }, "$expiresAt", expiresAt],
            },
            key,
          },
        },
      ],
      { upsert: true },
    );
  },
  async clear(key) {
    const collection = await attemptsCollection();
    await collection.deleteOne({ key });
  },
};

export function createAdminLoginRateLimiter(
  store: AdminLoginAttemptStore = mongoAttemptStore,
) {
  return {
    async isBlocked(key: string, now = new Date()) {
      const attempt = await store.find(key);
      return Boolean(
        attempt &&
        attempt.failures >= FAILURE_LIMIT &&
        attempt.expiresAt.getTime() > now.getTime(),
      );
    },
    async recordFailure(key: string, now = new Date()) {
      await store.increment(key, now, new Date(now.getTime() + WINDOW_MS));
    },
    async clear(key: string) {
      await store.clear(key);
    },
  };
}

export const adminLoginRateLimiter = createAdminLoginRateLimiter();

export function deriveAdminLoginKey(
  ip: string,
  phone: string,
  secret = adminRateLimitSecret(),
) {
  const normalizedPhone = phone.replace(/\D/g, "");
  return createHmac("sha256", secret)
    .update(`${ip}${normalizedPhone}`)
    .digest("hex");
}

export function adminClientIp(request: Request) {
  // NextRequest 16 does not declare `ip`, but a trusted runtime adapter may
  // attach it. Forwarding headers remain client-controlled and are ignored.
  const runtimeIp = (request as RequestWithRuntimeIp).ip;
  return typeof runtimeIp === "string" && runtimeIp.trim().length > 0
    ? runtimeIp.trim()
    : "unknown";
}

function adminRateLimitSecret() {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production")
    throw new Error("ADMIN_AUTH_SECRET environment variable is required.");
  return "blending-admin-development-secret";
}
