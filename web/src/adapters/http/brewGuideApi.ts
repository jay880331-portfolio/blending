import type {
  BrewGuide,
  BrewGuideEspresso,
  BrewGuideFilter,
} from "@/domain/brewGuide/brewGuide";

export type BrewGuideWritePayload = {
  storeId: string;
  beanId: string | null;
  title: string;
  filter?: BrewGuideFilter;
  espresso?: BrewGuideEspresso;
};

async function readApiJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(data?.error || "요청 처리에 실패했습니다.");
  }
  return data as T;
}

export async function fetchAuthorizedBrewGuideStores(): Promise<
  Array<{ id: string; storeName: string }>
> {
  const res = await fetch("/api/brew-guides?eligibleStores=1", {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as {
    stores?: Array<{ id: string; storeName: string }>;
  } | null;
  return data?.stores ?? [];
}

export async function fetchStoreBrewGuides(
  storeId: string,
): Promise<BrewGuide[]> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/brew-guides`,
    { cache: "no-store" },
  );
  const data = await readApiJson<{ guides: BrewGuide[] }>(res);
  return data.guides;
}

export async function fetchBrewGuideById(id: string): Promise<BrewGuide> {
  const res = await fetch(`/api/brew-guides/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const data = await readApiJson<{ guide: BrewGuide }>(res);
  return data.guide;
}

export async function createBrewGuideApi(
  payload: BrewGuideWritePayload,
): Promise<BrewGuide> {
  const res = await fetch("/api/brew-guides", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readApiJson<{ guide: BrewGuide }>(res);
  return data.guide;
}

export async function updateBrewGuideApi(
  id: string,
  payload: Omit<BrewGuideWritePayload, "storeId">,
): Promise<BrewGuide> {
  const res = await fetch(`/api/brew-guides/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readApiJson<{ guide: BrewGuide }>(res);
  return data.guide;
}

export async function deleteBrewGuideApi(id: string): Promise<void> {
  const res = await fetch(`/api/brew-guides/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await readApiJson<{ ok: boolean }>(res);
}
