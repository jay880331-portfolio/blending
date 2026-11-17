import type { WorkplaceLocation } from "../member/types";
import type { BaristaShowroom, ShowroomLocation } from "./types";

export function workplaceFullAddress(
  workplace: Pick<WorkplaceLocation, "address" | "detailAddress">,
) {
  return [workplace.address, workplace.detailAddress]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}

export function showroomLocationFromWorkplace(
  workplace: WorkplaceLocation,
): ShowroomLocation | undefined {
  const address = workplaceFullAddress(workplace);
  if (
    !Number.isFinite(workplace.lat) ||
    !Number.isFinite(workplace.lng) ||
    (workplace.lat === 0 && workplace.lng === 0)
  ) {
    return undefined;
  }
  return {
    latitude: workplace.lat,
    longitude: workplace.lng,
    ...(address ? { address } : {}),
  };
}

export function matchingWorkplaceId(
  workplaces: WorkplaceLocation[],
  showroom: Pick<BaristaShowroom, "storeName" | "location"> | null,
) {
  if (workplaces.length === 0) return null;
  if (!showroom) return workplaces[0]?.id ?? null;
  const address = showroom.location?.address?.trim();
  const byAddress = address
    ? workplaces.find(
        (workplace) => workplaceFullAddress(workplace) === address,
      )
    : undefined;
  if (byAddress) return byAddress.id;
  const byName = workplaces.find(
    (workplace) => workplace.name === showroom.storeName,
  );
  return byName?.id ?? workplaces[0]?.id ?? null;
}
