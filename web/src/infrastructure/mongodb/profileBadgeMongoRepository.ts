import { randomUUID } from "node:crypto";
import type {
  AdminProfileBadgeDto,
  AdminProfileBadgeInput,
  AdminUserBadgeDto,
  OfficialProfileBadge,
} from "@blending/admin-contracts";
import type { ClientSession } from "mongodb";
import {
  ProfileBadgeConflictError,
  ProfileBadgeInputError,
  type AdminProfileBadgeRepository,
} from "@/application/admin/profileBadgeUseCases";
import { getMongoDb } from "./client";

type CatalogDocument = AdminProfileBadgeDto;
type AssignmentDocument = {
  id: string;
  ownerId: string;
  badgeId: string;
  assignedAt: string;
  assignedBy: string;
};

const CATALOG = "member_profile_badges";
const ASSIGNMENTS = "member_profile_badge_assignments";
const CATALOG_SORT = { sortOrder: 1, name: 1, id: 1 } as const;

export const profileBadgeMongoRepository: AdminProfileBadgeRepository = {
  async list() {
    const db = await getMongoDb();
    return db
      .collection<CatalogDocument>(CATALOG)
      .find({}, { projection: { _id: 0 } })
      .sort(CATALOG_SORT)
      .toArray();
  },

  async findById(id) {
    const db = await getMongoDb();
    return db
      .collection<CatalogDocument>(CATALOG)
      .findOne({ id }, { projection: { _id: 0 } });
  },

  async create(input, session) {
    const db = await getMongoDb();
    await assertUniqueName(input.name, session);
    const now = new Date().toISOString();
    const document: CatalogDocument = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.collection<CatalogDocument>(CATALOG).insertOne(document, {
        session,
      });
    } catch (error) {
      throw duplicateOr(error, "같은 이름의 뱃지가 있습니다.");
    }
    return document;
  },

  async update(id, input, session) {
    const db = await getMongoDb();
    await assertUniqueName(input.name, session, id);
    const collection = db.collection<CatalogDocument>(CATALOG);
    let result;
    try {
      result = await collection.updateOne(
        { id },
        { $set: { ...input, updatedAt: new Date().toISOString() } },
        { session },
      );
    } catch (error) {
      throw duplicateOr(error, "같은 이름의 뱃지가 있습니다.");
    }
    if (!result.matchedCount) return null;
    return collection.findOne({ id }, { projection: { _id: 0 }, session });
  },

  async delete(id, session) {
    const db = await getMongoDb();
    const badge = await db
      .collection<CatalogDocument>(CATALOG)
      .findOneAndDelete({ id }, { projection: { _id: 0 }, session });
    if (!badge) return null;
    await db
      .collection<AssignmentDocument>(ASSIGNMENTS)
      .deleteMany({ badgeId: id }, { session });
    return badge;
  },

  async listForOwner(ownerId) {
    const assignments = await listAssignmentsForOwner(ownerId);
    return assignments.map(toOfficialBadge);
  },

  async listPrimaryForOwners(ownerIds) {
    const primaries = new Map<string, OfficialProfileBadge>();
    const ids = [...new Set(ownerIds.filter(Boolean))];
    if (ids.length === 0) return primaries;
    const grouped = await listAssignmentsForOwners(ids);
    for (const [ownerId, badges] of grouped) {
      const primary = badges[0];
      if (primary) primaries.set(ownerId, toOfficialBadge(primary));
    }
    return primaries;
  },

  async listAssignments(ownerId) {
    return listAssignmentsForOwner(ownerId);
  },

  async assign(ownerId, badgeId, assignedBy, session) {
    const db = await getMongoDb();
    const badge = await db
      .collection<CatalogDocument>(CATALOG)
      .findOne({ id: badgeId }, { projection: { _id: 0 }, session });
    if (!badge) throw new ProfileBadgeInputError("뱃지를 찾을 수 없습니다.");
    const existing = await db
      .collection<AssignmentDocument>(ASSIGNMENTS)
      .findOne({ ownerId, badgeId }, { session });
    if (existing)
      throw new ProfileBadgeConflictError("이미 부여된 뱃지입니다.");
    const document: AssignmentDocument = {
      id: randomUUID(),
      ownerId,
      badgeId,
      assignedAt: new Date().toISOString(),
      assignedBy,
    };
    try {
      await db
        .collection<AssignmentDocument>(ASSIGNMENTS)
        .insertOne(document, { session });
    } catch (error) {
      throw duplicateOr(error, "이미 부여된 뱃지입니다.");
    }
    return toUserBadge(badge, document);
  },

  async unassign(ownerId, badgeId, session) {
    const db = await getMongoDb();
    const assignment = await db
      .collection<AssignmentDocument>(ASSIGNMENTS)
      .findOneAndDelete({ ownerId, badgeId }, { session });
    if (!assignment) return null;
    const badge = await db
      .collection<CatalogDocument>(CATALOG)
      .findOne({ id: badgeId }, { projection: { _id: 0 }, session });
    if (!badge) return null;
    return toUserBadge(badge, assignment);
  },
};

async function listAssignmentsForOwner(ownerId: string) {
  const grouped = await listAssignmentsForOwners([ownerId]);
  return grouped.get(ownerId) ?? [];
}

async function listAssignmentsForOwners(ownerIds: string[]) {
  const grouped = new Map<string, AdminUserBadgeDto[]>();
  if (ownerIds.length === 0) return grouped;
  const db = await getMongoDb();
  const assignments = await db
    .collection<AssignmentDocument>(ASSIGNMENTS)
    .find({ ownerId: { $in: ownerIds } }, { projection: { _id: 0 } })
    .toArray();
  if (assignments.length === 0) return grouped;
  const badges = await db
    .collection<CatalogDocument>(CATALOG)
    .find(
      { id: { $in: assignments.map((assignment) => assignment.badgeId) } },
      { projection: { _id: 0 } },
    )
    .toArray();
  const byId = new Map(badges.map((badge) => [badge.id, badge]));
  const ranked = new Map<
    string,
    Array<{ sortOrder: number; dto: AdminUserBadgeDto }>
  >();
  for (const assignment of assignments) {
    const badge = byId.get(assignment.badgeId);
    if (!badge) continue;
    const current = ranked.get(assignment.ownerId) ?? [];
    current.push({
      sortOrder: badge.sortOrder,
      dto: toUserBadge(badge, assignment),
    });
    ranked.set(assignment.ownerId, current);
  }
  for (const [ownerId, items] of ranked) {
    grouped.set(
      ownerId,
      items
        .sort(
          (left, right) =>
            left.sortOrder - right.sortOrder ||
            left.dto.name.localeCompare(right.dto.name, "ko") ||
            left.dto.id.localeCompare(right.dto.id),
        )
        .map((item) => item.dto),
    );
  }
  return grouped;
}

async function assertUniqueName(
  name: string,
  session: ClientSession,
  exceptId?: string,
) {
  const db = await getMongoDb();
  const duplicate = await db
    .collection<CatalogDocument>(CATALOG)
    .findOne(exceptId ? { name, id: { $ne: exceptId } } : { name }, {
      projection: { _id: 1 },
      session,
    });
  if (duplicate)
    throw new ProfileBadgeConflictError("같은 이름의 뱃지가 있습니다.");
}

function duplicateOr(error: unknown, message: string) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  )
    throw new ProfileBadgeConflictError(message);
  throw error;
}

function toOfficialBadge(badge: AdminUserBadgeDto): OfficialProfileBadge {
  return {
    id: badge.id,
    name: badge.name,
    icon: badge.icon,
    imageUrl: badge.imageUrl,
  };
}

function toUserBadge(
  badge: CatalogDocument,
  assignment: AssignmentDocument,
): AdminUserBadgeDto {
  return {
    id: badge.id,
    name: badge.name,
    icon: badge.icon,
    imageUrl: badge.imageUrl ?? null,
    assignmentId: assignment.id,
    assignedAt: assignment.assignedAt,
  };
}
