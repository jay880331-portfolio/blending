import { getMongoDb } from "@/infrastructure/mongodb/client";

export type ActiveSanctionRepository = {
  activeForUser(userId: string): Promise<{ type: string } | null>;
};
export type LoginSanctionRepository = {
  activeLoginBlockForUser(userId: string): Promise<{ type: string } | null>;
};

export const sanctionMongoRepository: ActiveSanctionRepository = {
  async activeForUser(userId) {
    const now = new Date().toISOString();
    return (await getMongoDb())
      .collection<{ type: string }>("user_sanctions")
      .findOne(
        {
          userId,
          revokedAt: { $exists: false },
          type: { $in: ["content_write_restriction", "suspension", "ban"] },
          $or: [{ endsAt: { $exists: false } }, { endsAt: { $gt: now } }],
        },
        { projection: { _id: 0, type: 1 } },
      );
  },
};

export const loginSanctionMongoRepository: LoginSanctionRepository = {
  async activeLoginBlockForUser(userId) {
    const now = new Date().toISOString();
    return (await getMongoDb())
      .collection<{ type: string }>("user_sanctions")
      .findOne(
        {
          userId,
          revokedAt: { $exists: false },
          type: { $in: ["suspension", "ban"] },
          $or: [{ endsAt: { $exists: false } }, { endsAt: { $gt: now } }],
        },
        { projection: { _id: 0, type: 1 } },
      );
  },
};

export async function requireContentWriteAllowed(
  userId: string,
  repository: ActiveSanctionRepository = sanctionMongoRepository,
) {
  const sanction = await repository.activeForUser(userId);
  if (sanction)
    throw new Error(
      sanction.type === "content_write_restriction"
        ? "콘텐츠 작성 제한 중입니다."
        : "제재 중인 계정입니다.",
    );
}

export async function isLoginAllowed(
  userId: string,
  repository: LoginSanctionRepository = loginSanctionMongoRepository,
) {
  return !(await repository.activeLoginBlockForUser(userId));
}

export async function requireLoginAllowed(
  userId: string,
  repository: LoginSanctionRepository = loginSanctionMongoRepository,
) {
  if (!(await isLoginAllowed(userId, repository)))
    throw new Error("제재 중인 계정입니다.");
}
