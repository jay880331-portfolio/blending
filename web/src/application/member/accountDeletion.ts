export const WITHDRAWN_MEMBER_NAME = "탈퇴한 유저";

export type MongoCleanupObservation = {
  residualCount: number;
  legacyUploadUrls: string[];
};

export interface AccountDeletionCleanupRepository {
  observe(userId: string): Promise<MongoCleanupObservation>;
  cleanup(userId: string, withdrawnId: string): Promise<void>;
}
