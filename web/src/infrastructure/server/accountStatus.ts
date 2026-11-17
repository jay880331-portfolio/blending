import type { UserDocument } from "@/infrastructure/server/auth";

export function activeAccountFilter() {
  return {
    $or: [
      { accountStatus: "active" as const },
      { accountStatus: { $exists: false } },
    ],
  };
}

export function isActiveAccount(user: Pick<UserDocument, "accountStatus">) {
  return user.accountStatus === undefined || user.accountStatus === "active";
}
