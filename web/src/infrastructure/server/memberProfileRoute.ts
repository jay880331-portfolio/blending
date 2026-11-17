import type { ClientSession } from "mongodb";
import { type NextRequest, NextResponse } from "next/server";
import type {
  BaristaProfileDetails,
  MemberProfile,
  PublicMemberRole,
  SocialLinks,
  StatusMessage,
  WorkplaceLocation,
} from "@/domain/member/types";
import { getMongoClient, getMongoDb } from "@/infrastructure/mongodb/client";
import {
  profileFromUser,
  type MemberProfilePatch,
} from "@/infrastructure/mongodb/memberMongoRepository";
import { syncProfileSearchDocument } from "@/infrastructure/mongodb/searchMongoRepository";
import { activeAccountFilter } from "@/infrastructure/server/accountStatus";
import { getCurrentUser } from "@/infrastructure/server/auth";
import { jsonError, readJson } from "@/infrastructure/server/http";
import {
  PROHIBITED_PUBLIC_CONTENT,
  prohibitedPublicContent,
} from "@/infrastructure/server/ugcModeration";

const profileRouteDependencies = {
  getCurrentUser,
  getMongoClient,
  getMongoDb,
  syncProfileSearchDocument,
};

class InactiveProfileMutationError extends Error {}

export function createMemberProfileRoute(
  overrides: Partial<typeof profileRouteDependencies> = {},
): (request: NextRequest) => Promise<NextResponse> {
  const dependencies = { ...profileRouteDependencies, ...overrides };

  return async (request) => {
    const user = await dependencies.getCurrentUser(request);
    if (!user) return jsonError("로그인이 필요합니다.", 401);

    const patch = pickProfilePatch(await readJson<MemberProfilePatch>(request));
    if (prohibitedPublicContent(...publicProfileText(patch)))
      return jsonError(
        PROHIBITED_PUBLIC_CONTENT.message,
        400,
        PROHIBITED_PUBLIC_CONTENT.code,
      );
    if (patch.workplaceLocations)
      patch.workplaceLocations = await repairWorkplaceLocations(
        patch.workplaceLocations,
      );
    if (user.role === "admin" && patch.role)
      return jsonError(
        "관리자 권한은 관리자 사이트에서만 변경할 수 있습니다.",
        403,
      );
    const insertDefaults = withoutPatchFields(profileFromUser(user), patch);
    const update =
      Object.keys(patch).length > 0
        ? { $set: patch, $setOnInsert: insertDefaults }
        : { $setOnInsert: insertDefaults };

    let session: ClientSession | undefined;
    try {
      const db = await dependencies.getMongoDb();
      const profiles = db.collection<MemberProfile & { ownerId?: string }>(
        "member_profiles",
      );
      session = (await dependencies.getMongoClient()).startSession();
      await session.withTransaction(async () => {
        const userUpdate = await db.collection("users").updateOne(
          { id: user.id, ...activeAccountFilter() },
          {
            $set: {
              name: patch.name ?? user.name,
              handle: patch.handle ?? user.handle,
              role: patch.role ?? user.role,
              avatarUrl: patch.avatarUrl ?? user.avatarUrl,
              workplaces: patch.workplaces ?? user.workplaces,
              workplaceLocations:
                patch.workplaceLocations ?? user.workplaceLocations ?? [],
              specialties: patch.specialties ?? user.specialties,
              socials: patch.socials ?? user.socials,
              updatedAt: new Date(),
            },
          },
          { session },
        );
        if (userUpdate.matchedCount !== 1)
          throw new InactiveProfileMutationError();

        await profiles.updateOne({ ownerId: user.id }, update, {
          upsert: true,
          session,
        });
        const profile = await profiles.findOne(
          { ownerId: user.id },
          { session },
        );
        if (profile)
          await dependencies.syncProfileSearchDocument(profile, session);
      });
    } catch (error) {
      return jsonError(
        "프로필을 저장할 수 없습니다.",
        error instanceof InactiveProfileMutationError ? 409 : 500,
      );
    } finally {
      await session?.endSession();
    }

    return NextResponse.json({ success: true });
  };
}

export const memberProfileRoute = createMemberProfileRoute();

function withoutPatchFields(
  profile: MemberProfile & { ownerId: string },
  patch: MemberProfilePatch,
) {
  const defaults: Partial<MemberProfile & { ownerId: string }> = { ...profile };
  Object.keys(patch).forEach((key) => {
    delete defaults[key as keyof typeof defaults];
  });
  return defaults;
}

function pickProfilePatch(input: Partial<MemberProfilePatch>) {
  const patch: MemberProfilePatch = {};

  if (typeof input.name === "string") patch.name = input.name;
  if (typeof input.handle === "string") patch.handle = input.handle;
  if (isMemberRole(input.role)) patch.role = input.role;
  if (typeof input.avatarUrl === "string") patch.avatarUrl = input.avatarUrl;
  if (isStatusMessage(input.status)) patch.status = input.status;
  if (typeof input.workplace === "string") patch.workplace = input.workplace;
  if (isStringArray(input.workplaces)) patch.workplaces = input.workplaces;
  if (isWorkplaceLocations(input.workplaceLocations))
    patch.workplaceLocations = input.workplaceLocations;
  if (isStringArray(input.specialties)) patch.specialties = input.specialties;
  if (typeof input.bio === "string") patch.bio = input.bio;
  if (typeof input.activityRegion === "string")
    patch.activityRegion = input.activityRegion;
  if (typeof input.isPortfolioPublic === "boolean")
    patch.isPortfolioPublic = input.isPortfolioPublic;
  if (typeof input.certificateName === "string")
    patch.certificateName = input.certificateName;
  if (isBaristaProfileDetails(input.baristaProfile))
    patch.baristaProfile = input.baristaProfile;
  if (isSocialLinks(input.socials)) patch.socials = input.socials;

  return patch;
}

function publicProfileText(patch: MemberProfilePatch) {
  return [
    patch.name,
    patch.handle,
    patch.workplace,
    patch.bio,
    patch.activityRegion,
    patch.certificateName,
    ...(patch.workplaces ?? []),
    ...(patch.specialties ?? []),
    ...(patch.workplaceLocations?.flatMap((location) => [
      location.name,
      location.address,
      location.detailAddress,
      location.displayName,
      ...(location.employmentTypes ?? []),
    ]) ?? []),
  ];
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isBaristaProfileDetails(
  value: unknown,
): value is BaristaProfileDetails {
  if (typeof value !== "object" || value === null) return false;
  const details = value as Record<string, unknown>;

  return (
    typeof details.contactPhone === "string" &&
    isStringArray(details.employmentTypes) &&
    typeof details.totalExperience === "string" &&
    isStringArray(details.certificateFileUrls) &&
    isStringArray(details.espressoMachineBrands) &&
    typeof details.espressoMachineBrandOther === "string" &&
    isStringArray(details.grinderBrands) &&
    typeof details.grinderBrandOther === "string" &&
    isStringArray(details.roasterBrands) &&
    typeof details.roasterBrandOther === "string" &&
    typeof details.preferredBeans === "string" &&
    isStringArray(details.preferredBeanNotes)
  );
}

function isWorkplaceLocations(value: unknown): value is WorkplaceLocation[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const location = item as Record<string, unknown>;
      return (
        typeof location.id === "string" &&
        typeof location.name === "string" &&
        typeof location.address === "string" &&
        isOptionalString(location.postalCode) &&
        isOptionalString(location.detailAddress) &&
        (location.employmentTypes == null ||
          isStringArray(location.employmentTypes)) &&
        typeof location.lat === "number" &&
        typeof location.lng === "number" &&
        typeof location.displayName === "string"
      );
    })
  );
}

async function repairWorkplaceLocations(locations: WorkplaceLocation[]) {
  const credentials = getNaverGeocodeCredentials();
  if (!credentials) return locations;

  return Promise.all(
    locations.map(async (location) => {
      if (location.lat !== 0 || location.lng !== 0) return location;

      try {
        const response = await fetch(
          `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(location.address)}`,
          {
            headers: {
              "x-ncp-apigw-api-key-id": credentials.keyId,
              "x-ncp-apigw-api-key": credentials.key,
            },
          },
        );
        if (!response.ok) return location;

        const data = (await response.json()) as {
          addresses?: Array<{ x?: string; y?: string }>;
        };
        const result = data.addresses?.[0];
        const lng = Number(result?.x);
        const lat = Number(result?.y);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return location;

        return { ...location, lat, lng };
      } catch {
        return location;
      }
    }),
  );
}

function getNaverGeocodeCredentials() {
  const keyId =
    process.env.NAVER_MAPS_CLIENT_ID ??
    process.env.NAVER_MAP_CLIENT_ID ??
    process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID ??
    process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const key =
    process.env.NAVER_MAPS_CLIENT_SECRET ??
    process.env.NAVER_MAP_CLIENT_SECRET ??
    process.env.NAVER_MAPS_API_KEY;

  return keyId && key ? { keyId, key } : null;
}

function isOptionalString(value: unknown) {
  return value == null || typeof value === "string";
}

function isMemberRole(value: unknown): value is PublicMemberRole {
  return value === "barista" || value === "enthusiast" || value === "partner";
}

function isStatusMessage(value: unknown): value is StatusMessage {
  return value === "guest" || value === "job-seeking" || value === "focused";
}

function isSocialLinks(value: unknown): value is SocialLinks {
  if (typeof value !== "object" || value === null) return false;
  const links = value as Record<string, unknown>;
  return (
    typeof links.instagram === "string" &&
    typeof links.threads === "string" &&
    typeof links.website === "string" &&
    typeof links.recipeUrl === "string"
  );
}
