import { randomBytes } from "node:crypto";
import type { EventCategory, RoastCategory } from "@/domain/community/types";
import type { PartnerCategoryValue } from "@/domain/partner/types";

const eventCategories = new Set<EventCategory>([
  "official",
  "seminar",
  "meetup",
]);
const roastCategories = new Set<RoastCategory>(["light", "medium", "dark"]);
const partnerCategories = new Set<PartnerCategoryValue>([
  "espresso-machine",
  "grinder",
  "ice-equipment",
  "brewing-roaster",
  "ingredient",
  "supplies",
]);

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createdAgoNow() {
  return "방금 전";
}

export function firstOrFallback(value: string | undefined, fallback: string) {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function eventCategoryOrNull(value: unknown): EventCategory | null {
  return typeof value === "string" &&
    eventCategories.has(value as EventCategory)
    ? (value as EventCategory)
    : null;
}

export function roastCategoryOrNull(value: unknown): RoastCategory | null {
  return typeof value === "string" &&
    roastCategories.has(value as RoastCategory)
    ? (value as RoastCategory)
    : null;
}

export function partnerCategoryOrNull(
  value: unknown,
): PartnerCategoryValue | null {
  return typeof value === "string" &&
    partnerCategories.has(value as PartnerCategoryValue)
    ? (value as PartnerCategoryValue)
    : null;
}
