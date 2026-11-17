import { toKstDateKey } from "@/domain/passport/ledger";

export type BeanKind = "bean" | "dripbag";
export type BeanGrindOption = "whole" | "drip" | "machine";

export const BEAN_GRIND_OPTIONS: ReadonlyArray<{
  value: BeanGrindOption;
  label: string;
}> = [
  { value: "whole", label: "홀빈" },
  { value: "drip", label: "드립용" },
  { value: "machine", label: "머신용" },
];

export const BEAN_GRIND_LABELS: Record<BeanGrindOption, string> = {
  whole: "홀빈",
  drip: "드립용",
  machine: "머신용",
};

export const BEAN_NOTES_MAX_LENGTH = 200;
export const RESERVATION_NOTE_MAX_LENGTH = 100;
export const RESERVATION_REJECT_REASON_MAX_LENGTH = 100;
export const RESERVATION_MAX_DAYS_AHEAD = 14;
export const RESERVATION_MIN_QUANTITY = 1;
export const RESERVATION_MAX_QUANTITY = 10;

export type ShowroomBean = {
  id: string;
  storeId: string;
  baristaId: string;
  kind: BeanKind;
  name: string;
  notes: string;
  unit: string;
  price: number;
  grindOptions: BeanGrindOption[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReservationStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "REJECTED"
  | "PICKED_UP"
  | "CANCELLED";

export type ReservationHistoryEntry = {
  status: ReservationStatus;
  by: string;
  at: string;
};

export type BeanReservation = {
  id: string;
  userId: string;
  storeId: string;
  storeName?: string;
  customerName?: string;
  beanId: string;
  beanSnapshot: {
    name: string;
    kind: BeanKind;
    unit: string;
    price: number;
  };
  grind: BeanGrindOption | null;
  quantity: number;
  pickupDate: string;
  note: string;
  status: ReservationStatus;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
  history: ReservationHistoryEntry[];
};

const VALID_GRINDS = new Set<string>(["whole", "drip", "machine"]);

export function isValidBeanKind(value: unknown): value is BeanKind {
  return value === "bean" || value === "dripbag";
}

export function isValidBeanGrind(value: unknown): value is BeanGrindOption {
  return typeof value === "string" && VALID_GRINDS.has(value);
}

export function parseBeanInput(raw: unknown):
  | {
      ok: true;
      value: {
        kind: BeanKind;
        name: string;
        notes: string;
        unit: string;
        price: number;
        grindOptions: BeanGrindOption[];
        active: boolean;
      };
    }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "상품 입력값이 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;

  if (!isValidBeanKind(input.kind)) {
    return { ok: false, error: "상품 종류를 선택해주세요." };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || [...name].length > 60) {
    return { ok: false, error: "상품명은 1~60자로 입력해주세요." };
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if ([...notes].length > BEAN_NOTES_MAX_LENGTH) {
    return {
      ok: false,
      error: `설명은 ${BEAN_NOTES_MAX_LENGTH}자 이하로 입력해주세요.`,
    };
  }

  const unit = typeof input.unit === "string" ? input.unit.trim() : "";
  if (!unit || [...unit].length > 30) {
    return { ok: false, error: "단위를 입력해주세요 (예: 200g, 10개입)." };
  }

  if (
    typeof input.price !== "number" ||
    !Number.isInteger(input.price) ||
    input.price < 0
  ) {
    return { ok: false, error: "가격은 0원 이상의 정수로 입력해주세요." };
  }

  const grindOptions: BeanGrindOption[] = [];
  if (input.kind === "bean") {
    if (!Array.isArray(input.grindOptions)) {
      return { ok: false, error: "분쇄 옵션을 1개 이상 선택해주세요." };
    }
    for (const opt of input.grindOptions) {
      if (!isValidBeanGrind(opt)) {
        return { ok: false, error: "분쇄 옵션 값이 올바르지 않습니다." };
      }
      if (!grindOptions.includes(opt)) grindOptions.push(opt);
    }
    if (grindOptions.length === 0) {
      return { ok: false, error: "분쇄 옵션을 1개 이상 선택해주세요." };
    }
  }

  const active = typeof input.active === "boolean" ? input.active : true;

  return {
    ok: true,
    value: {
      kind: input.kind,
      name,
      notes,
      unit,
      price: input.price,
      grindOptions,
      active,
    },
  };
}

export function addKstDays(kstDate: string, days: number): string {
  const [y, m, d] = kstDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function parseReservationInput(
  raw: unknown,
  bean: Pick<ShowroomBean, "kind" | "grindOptions" | "active">,
  now = new Date(),
):
  | {
      ok: true;
      value: {
        grind: BeanGrindOption | null;
        quantity: number;
        pickupDate: string;
        note: string;
      };
    }
  | { ok: false; error: string } {
  if (!bean.active) {
    return { ok: false, error: "현재 예약할 수 없는 상품입니다." };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "예약 입력값이 올바르지 않습니다." };
  }
  const input = raw as Record<string, unknown>;

  let grind: BeanGrindOption | null = null;
  if (bean.kind === "bean") {
    if (
      !isValidBeanGrind(input.grind) ||
      !bean.grindOptions.includes(input.grind)
    ) {
      return { ok: false, error: "분쇄 옵션을 선택해주세요." };
    }
    grind = input.grind;
  }

  if (
    typeof input.quantity !== "number" ||
    !Number.isInteger(input.quantity) ||
    input.quantity < RESERVATION_MIN_QUANTITY ||
    input.quantity > RESERVATION_MAX_QUANTITY
  ) {
    return {
      ok: false,
      error: `수량은 ${RESERVATION_MIN_QUANTITY}~${RESERVATION_MAX_QUANTITY}개 사이로 선택해주세요.`,
    };
  }

  const pickupDate =
    typeof input.pickupDate === "string" ? input.pickupDate.trim() : "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) ||
    !isValidCalendarDate(pickupDate)
  ) {
    return { ok: false, error: "픽업 날짜를 올바르게 선택해주세요." };
  }
  const todayKst = toKstDateKey(now);
  const maxKst = addKstDays(todayKst, RESERVATION_MAX_DAYS_AHEAD);
  if (pickupDate < todayKst || pickupDate > maxKst) {
    return {
      ok: false,
      error: "픽업 날짜는 오늘부터 14일 이내로 선택해주세요.",
    };
  }

  const note = typeof input.note === "string" ? input.note.trim() : "";
  if ([...note].length > RESERVATION_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `메모는 ${RESERVATION_NOTE_MAX_LENGTH}자 이하로 입력해주세요.`,
    };
  }

  return {
    ok: true,
    value: {
      grind,
      quantity: input.quantity,
      pickupDate,
      note,
    },
  };
}

function isValidCalendarDate(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function canTransitionReservation({
  currentStatus,
  nextStatus,
  actorRole,
  pickupDate,
  now = new Date(),
}: {
  currentStatus: ReservationStatus;
  nextStatus: ReservationStatus;
  actorRole: "customer" | "staff";
  pickupDate: string;
  now?: Date;
}): { ok: true } | { ok: false; error: string; status: 400 | 403 | 409 } {
  if (actorRole === "customer") {
    if (nextStatus !== "CANCELLED") {
      return {
        ok: false,
        error: "허용되지 않은 상태 변경입니다.",
        status: 403,
      };
    }
    if (currentStatus !== "REQUESTED" && currentStatus !== "CONFIRMED") {
      return {
        ok: false,
        error: "이미 처리된 예약은 취소할 수 없습니다.",
        status: 409,
      };
    }
    const todayKst = toKstDateKey(now);
    if (todayKst >= pickupDate) {
      return {
        ok: false,
        error: "픽업일 당일 이후에는 취소할 수 없습니다.",
        status: 409,
      };
    }
    return { ok: true };
  }

  // staff
  if (currentStatus === "REQUESTED") {
    if (nextStatus === "CONFIRMED" || nextStatus === "REJECTED") {
      return { ok: true };
    }
  }
  if (currentStatus === "CONFIRMED" && nextStatus === "PICKED_UP") {
    return { ok: true };
  }

  return {
    ok: false,
    error: "현재 예약 상태에서는 변경할 수 없습니다.",
    status: 409,
  };
}
