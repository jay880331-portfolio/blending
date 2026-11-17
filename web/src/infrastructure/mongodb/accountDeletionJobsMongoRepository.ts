import { randomUUID } from "node:crypto";
import {
  ACCOUNT_DELETION_DEADLINE_MS,
  ACCOUNT_DELETION_LEASE_MS,
  type AccountDeletionJob,
  type AccountDeletionJobRepository,
  type FailedAccountDeletionJobDto,
} from "@/application/member/accountDeletionJobs";
import {
  activeAccountFilter,
  isActiveAccount,
} from "@/infrastructure/server/accountStatus";
import type { ClientSession, Db, MongoClient } from "mongodb";
import { getMongoClient, getMongoDb } from "./client";

const USER_FIELDS_TO_UNSET = {
  phone: "",
  email: "",
  passwordHash: "",
  socialAccounts: "",
  handle: "",
  avatarUrl: "",
  lastLoginMethod: "",
  lastLoginAt: "",
  lastSeenAt: "",
} as const;

type UserSnapshot = {
  id: string;
  accountStatus?: "active" | "suspended" | "deleted" | "deleting";
  phone?: string;
  socialAccounts?: Array<{ provider: string; providerId: string }>;
};

export type {
  AccountDeletionJobRepository,
  FailedAccountDeletionJobDto,
} from "@/application/member/accountDeletionJobs";

export class AccountDeletionJobsMongoRepository implements AccountDeletionJobRepository {
  constructor(
    private readonly getClient: () => Promise<MongoClient> = getMongoClient,
    private readonly getDb: () => Promise<Db> = getMongoDb,
  ) {}

  async prepare(
    userId: string,
    withdrawnId: string,
    now: Date,
  ): Promise<string> {
    const session = (await this.getClient()).startSession();
    try {
      return await session.withTransaction(() =>
        this.prepareInTransaction(userId, withdrawnId, now, session),
      );
    } finally {
      await session.endSession();
    }
  }

  private async prepareInTransaction(
    userId: string,
    withdrawnId: string,
    now: Date,
    session: ClientSession,
  ) {
    const db = await this.getDb();
    const jobs = db.collection<AccountDeletionJob>("account_deletion_jobs");
    if (await jobs.findOne({ userId }, { session }))
      throw new Error("Account deletion job already exists");

    const user = await db.collection<UserSnapshot>("users").findOne(
      { id: userId },
      {
        projection: { phone: 1, socialAccounts: 1, accountStatus: 1 },
        session,
      },
    );
    if (!user || !isActiveAccount(user)) throw new Error("User is not active");

    const scrubbed = await db
      .collection<UserSnapshot>("users")
      .findOneAndUpdate(
        { id: userId, ...activeAccountFilter() },
        {
          $set: { accountStatus: "deleting", name: "탈퇴한 유저" },
          $unset: USER_FIELDS_TO_UNSET,
        },
        { returnDocument: "after", session },
      );
    if (!scrubbed) throw new Error("User is not active");

    if (user.phone)
      await db
        .collection("phone_verifications")
        .deleteMany({ phone: user.phone }, { session });
    for (const account of user.socialAccounts ?? [])
      await db.collection("pending_social_signups").deleteMany(
        {
          "profile.provider": account.provider,
          "profile.providerId": account.providerId,
        },
        { session },
      );

    const id = randomUUID();
    const createdAt = new Date(now);
    await jobs.insertOne(
      {
        id,
        userId,
        withdrawnId,
        status: "pending",
        attempts: 0,
        cleanPasses: 0,
        createdAt,
        updatedAt: new Date(now),
        nextAttemptAt: new Date(now),
        deadlineAt: new Date(now.getTime() + ACCOUNT_DELETION_DEADLINE_MS),
      },
      { session },
    );
    return id;
  }

  async claimById(id: string, now: Date): Promise<AccountDeletionJob | null> {
    return this.claim({ id, ...eligibleFilter(now) }, now);
  }

  async claimDue(now: Date, limit: number): Promise<AccountDeletionJob[]> {
    const jobs: AccountDeletionJob[] = [];
    for (let index = 0; index < Math.max(0, Math.floor(limit)); index += 1) {
      const job = await this.claim(eligibleFilter(now), now);
      if (!job) break;
      jobs.push(job);
    }
    return jobs;
  }

  private async claim(filter: object, now: Date) {
    return await (await this.getDb())
      .collection<AccountDeletionJob>("account_deletion_jobs")
      .findOneAndUpdate(
        filter,
        {
          $set: {
            status: "running",
            updatedAt: new Date(now),
            leaseExpiresAt: new Date(now.getTime() + ACCOUNT_DELETION_LEASE_MS),
          },
        },
        { returnDocument: "after", sort: { nextAttemptAt: 1 } },
      );
  }

  async save(
    claimedJob: AccountDeletionJob,
    nextJob: AccountDeletionJob,
  ): Promise<boolean> {
    const filter = runningLeaseFilter(claimedJob);
    if (!filter) return false;
    const result = await (await this.getDb())
      .collection<AccountDeletionJob>("account_deletion_jobs")
      .replaceOne(filter, nextJob);
    return result.matchedCount === 1;
  }

  async complete(job: AccountDeletionJob): Promise<boolean> {
    const filter = runningLeaseFilter(job);
    if (!filter) return false;
    const result = await (await this.getDb())
      .collection<AccountDeletionJob>("account_deletion_jobs")
      .deleteOne(filter);
    return result.deletedCount === 1;
  }

  async listFailed(): Promise<FailedAccountDeletionJobDto[]> {
    const jobs = await (
      await this.getDb()
    )
      .collection<AccountDeletionJob>("account_deletion_jobs")
      .find(
        { status: "failed" },
        {
          projection: {
            _id: 0,
            id: 1,
            status: 1,
            attempts: 1,
            createdAt: 1,
            updatedAt: 1,
            deadlineAt: 1,
            lastErrorCode: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .toArray();
    return jobs.map(
      ({
        id,
        status,
        attempts,
        createdAt,
        updatedAt,
        deadlineAt,
        lastErrorCode,
      }) => ({
        id,
        status,
        attempts,
        createdAt,
        updatedAt,
        deadlineAt,
        ...(lastErrorCode ? { lastErrorCode } : {}),
      }),
    );
  }

  async retryFailed(
    id: string,
    now: Date,
    session?: ClientSession,
  ): Promise<boolean> {
    const result = await (await this.getDb())
      .collection<AccountDeletionJob>("account_deletion_jobs")
      .updateOne(
        { id, status: "failed" },
        {
          $set: {
            status: "pending",
            attempts: 0,
            cleanPasses: 0,
            updatedAt: new Date(now),
            nextAttemptAt: new Date(now),
            deadlineAt: new Date(now.getTime() + ACCOUNT_DELETION_DEADLINE_MS),
          },
          $unset: { leaseExpiresAt: "", lastErrorCode: "" },
        },
        { ...(session ? { session } : {}) },
      );
    return result.matchedCount === 1;
  }
}

function eligibleFilter(now: Date) {
  return {
    $or: [
      {
        status: { $in: ["pending", "verifying"] },
        nextAttemptAt: { $lte: now },
      },
      { status: "running", leaseExpiresAt: { $lte: now } },
    ],
  };
}

function runningLeaseFilter(job: AccountDeletionJob) {
  if (!job.leaseExpiresAt) return null;
  return {
    id: job.id,
    status: "running" as const,
    leaseExpiresAt: job.leaseExpiresAt,
  };
}
