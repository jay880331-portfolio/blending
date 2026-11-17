import type {
  BeanGrindOption,
  BeanKind,
  BeanReservation,
  ReservationStatus,
  ShowroomBean,
} from "@/domain/showroom/bean";

export async function fetchStoreBeans(
  storeId: string,
  includeInactive = false,
): Promise<ShowroomBean[]> {
  const query = includeInactive ? "?includeInactive=true" : "";
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/beans${query}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("원두·드립백 목록을 불러오지 못했습니다.");
  const data = (await res.json()) as { beans: ShowroomBean[] };
  return data.beans;
}

export async function createStoreBeanApi(
  storeId: string,
  payload: {
    kind: BeanKind;
    name: string;
    notes: string;
    unit: string;
    price: number;
    grindOptions: BeanGrindOption[];
    active?: boolean;
  },
): Promise<ShowroomBean> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/beans`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "상품을 등록하지 못했습니다.");
  }
  const data = (await res.json()) as { bean: ShowroomBean };
  return data.bean;
}

export async function updateStoreBeanApi(
  storeId: string,
  beanId: string,
  payload: Partial<{
    kind: BeanKind;
    name: string;
    notes: string;
    unit: string;
    price: number;
    grindOptions: BeanGrindOption[];
    active: boolean;
  }>,
): Promise<ShowroomBean> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/beans/${encodeURIComponent(beanId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "상품을 수정하지 못했습니다.");
  }
  const data = (await res.json()) as { bean: ShowroomBean };
  return data.bean;
}

export async function deleteStoreBeanApi(
  storeId: string,
  beanId: string,
): Promise<void> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/beans/${encodeURIComponent(beanId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "상품을 삭제하지 못했습니다.");
  }
}

export async function createBeanReservationApi(
  storeId: string,
  payload: {
    beanId: string;
    grind: BeanGrindOption | null;
    quantity: number;
    pickupDate: string;
    note: string;
  },
): Promise<BeanReservation> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/reservations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "예약을 신청하지 못했습니다.");
  }
  const data = (await res.json()) as { reservation: BeanReservation };
  return data.reservation;
}

export async function fetchStoreReservationsApi(
  storeId: string,
): Promise<BeanReservation[]> {
  const res = await fetch(
    `/api/showroom/${encodeURIComponent(storeId)}/reservations`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("매장 예약 목록을 불러오지 못했습니다.");
  const data = (await res.json()) as { reservations: BeanReservation[] };
  return data.reservations;
}

export async function fetchMemberReservationsApi(): Promise<BeanReservation[]> {
  const res = await fetch("/api/member/reservations", { cache: "no-store" });
  if (!res.ok) throw new Error("내 예약 목록을 불러오지 못했습니다.");
  const data = (await res.json()) as { reservations: BeanReservation[] };
  return data.reservations;
}

export async function transitionBeanReservationApi(
  reservationId: string,
  status: ReservationStatus,
  rejectReason?: string,
): Promise<BeanReservation> {
  const res = await fetch(
    `/api/reservations/${encodeURIComponent(reservationId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, rejectReason }),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "예약 상태를 변경하지 못했습니다.");
  }
  const data = (await res.json()) as { reservation: BeanReservation };
  return data.reservation;
}
