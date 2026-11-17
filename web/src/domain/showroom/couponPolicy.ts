import type { CouponBenefit, ShowroomCoupon } from "./types";

export class CouponPolicyError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export type CouponDraft = {
  title: string;
  couponType: "regular" | "timesale";
  usageScope: "SINGLE" | "GROUP" | "ALL";
  storeId?: string;
  allowedStoreIds?: string[];
  benefit: CouponBenefit;
  validFrom: string;
  validUntil: string;
  totalLimit?: number;
  perUserLimit: number;
  conditions: string;
  allowStacking: boolean;
  costBearer: "ISSUER" | "REDEEMING_STORE";
};

function text(value: unknown, name: string, max: number, required = false) {
  if (value == null && !required) return "";
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new CouponPolicyError(`${name}을 확인해 주세요. (최대 ${max}자)`);
  return value.trim();
}
function integer(value: unknown, name: string, min: number, max: number) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new CouponPolicyError(
      `${name}은 ${min}~${max} 사이 정수로 입력해 주세요.`,
    );
  return value;
}

export function parseCouponDraft(
  input: unknown,
  now = new Date(),
): CouponDraft {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CouponPolicyError("쿠폰 정보를 확인해 주세요.");
  const body = input as Record<string, unknown>;
  if (body.couponType !== "regular" && body.couponType !== "timesale")
    throw new CouponPolicyError("쿠폰 종류를 선택해 주세요.");
  if (
    typeof body.usageScope !== "string" ||
    !["SINGLE", "GROUP", "ALL"].includes(body.usageScope)
  )
    throw new CouponPolicyError("사용 범위를 선택해 주세요.");
  const usageScope = body.usageScope as CouponDraft["usageScope"];
  if (
    !body.benefit ||
    typeof body.benefit !== "object" ||
    Array.isArray(body.benefit)
  )
    throw new CouponPolicyError("혜택을 입력해 주세요.");
  const raw = body.benefit as Record<string, unknown>;
  if (raw.kind !== "AMOUNT" && raw.kind !== "PERCENT" && raw.kind !== "ITEM")
    throw new CouponPolicyError("혜택 유형을 선택해 주세요.");
  const benefit: CouponBenefit = { kind: raw.kind };
  if (raw.kind === "ITEM")
    benefit.itemName = text(raw.itemName, "제공 메뉴", 80, true);
  else
    benefit.value = integer(
      raw.value,
      "할인 값",
      1,
      raw.kind === "PERCENT" ? 100 : 1000000,
    );
  if (raw.minimumOrder != null)
    benefit.minimumOrder = integer(
      raw.minimumOrder,
      "최소 주문 금액",
      0,
      10000000,
    );
  if (raw.maximumDiscount != null) {
    if (raw.kind !== "PERCENT")
      throw new CouponPolicyError(
        "최대 할인 금액은 비율 할인에만 지정할 수 있습니다.",
      );
    benefit.maximumDiscount = integer(
      raw.maximumDiscount,
      "최대 할인 금액",
      1,
      1000000,
    );
  }
  const start = Date.parse(text(body.validFrom, "시작 일시", 40, true));
  const end = Date.parse(text(body.validUntil, "종료 일시", 40, true));
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end <= now.getTime()
  )
    throw new CouponPolicyError(
      "종료 일시는 시작 일시와 현재보다 늦어야 합니다.",
    );
  if (typeof body.allowStacking !== "boolean")
    throw new CouponPolicyError("중복 할인 여부를 선택해 주세요.");
  if (body.costBearer !== "ISSUER" && body.costBearer !== "REDEEMING_STORE")
    throw new CouponPolicyError("비용 부담 주체를 선택해 주세요.");
  if (usageScope === "ALL" && body.costBearer !== "ISSUER")
    throw new CouponPolicyError(
      "전국 공용 쿠폰은 발행 매장 비용 부담으로만 요청할 수 있습니다.",
    );
  const storeId =
    usageScope === "SINGLE"
      ? text(body.storeId, "사용 매장", 100, true)
      : undefined;
  let allowedStoreIds: string[] | undefined;
  if (usageScope === "GROUP") {
    if (
      !Array.isArray(body.allowedStoreIds) ||
      body.allowedStoreIds.length < 1 ||
      body.allowedStoreIds.length > 100
    )
      throw new CouponPolicyError("연합 매장을 1~100개 선택해 주세요.");
    allowedStoreIds = [
      ...new Set(
        body.allowedStoreIds.map((id) => text(id, "매장 ID", 100, true)),
      ),
    ];
  }
  return {
    title: text(body.title, "쿠폰 제목", 80, true),
    couponType: body.couponType,
    usageScope,
    storeId,
    allowedStoreIds,
    benefit,
    validFrom: new Date(start).toISOString(),
    validUntil: new Date(end).toISOString(),
    totalLimit:
      body.totalLimit == null
        ? undefined
        : integer(body.totalLimit, "총 발급 수량", 1, 1000000),
    perUserLimit: integer(body.perUserLimit, "고객당 발급 수량", 1, 10),
    conditions: text(body.conditions, "추가 조건", 500),
    allowStacking: body.allowStacking,
    costBearer: body.costBearer,
  };
}

export function benefitLabel(benefit: CouponBenefit) {
  if (benefit.kind === "ITEM") return `${benefit.itemName} 1잔 제공`;
  return `${benefit.value?.toLocaleString("ko-KR")}${benefit.kind === "PERCENT" ? "%" : "원"} 할인`;
}
export function couponConditions(coupon: ShowroomCoupon): string[] {
  if (coupon.policyVersion !== 2) return [];
  return [
    coupon.benefit?.minimumOrder
      ? `${coupon.benefit.minimumOrder.toLocaleString("ko-KR")}원 이상 주문`
      : "",
    coupon.benefit?.maximumDiscount
      ? `최대 ${coupon.benefit.maximumDiscount.toLocaleString("ko-KR")}원 할인`
      : "",
    coupon.allowStacking ? "다른 할인과 중복 가능" : "다른 할인과 중복 불가",
    coupon.conditions ?? "",
  ].filter(Boolean);
}
export function canIssueCoupon(coupon: ShowroomCoupon, now = new Date()) {
  return (
    !coupon.issuanceStoppedAt &&
    (coupon.policyVersion !== 2 || coupon.approvalState === "ACTIVE") &&
    (!coupon.validFrom || Date.parse(coupon.validFrom) <= now.getTime()) &&
    Date.parse(coupon.validUntil) > now.getTime() &&
    (coupon.totalLimit == null || (coupon.issuedCount ?? 0) < coupon.totalLimit)
  );
}
