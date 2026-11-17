"use client";
import { useState } from "react";
import type {
  BaristaShowroom,
  CouponBenefit,
  ShowroomCoupon,
} from "@/domain/showroom/types";
import { benefitLabel, parseCouponDraft } from "@/domain/showroom/couponPolicy";
import { addCoupon } from "@/adapters/http/showroomApi";
import { Button } from "@/ui/shared/Button";
import { PartnerField } from "@/ui/shared/Field";
import { Input, Select, Textarea } from "@/ui/shared/Input";
import { couponUsageScopeLabel } from "@/domain/showroom/couponStatus";
import { CouponTerms } from "./CouponTerms";

function localTime(value: number) {
  return new Date(value + 9 * 3600000).toISOString().slice(0, 16);
}
export function CouponCreateForm({
  showroom,
  stores,
  onCreated,
  onCancel,
}: {
  showroom: BaristaShowroom;
  stores: BaristaShowroom[];
  onCreated: (coupon: ShowroomCoupon) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [couponType, setType] = useState<"regular" | "timesale">("regular");
  const [kind, setKind] = useState<CouponBenefit["kind"]>("AMOUNT");
  const [value, setValue] = useState("1000");
  const [itemName, setItemName] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [start, setStart] = useState(() => localTime(Date.now()));
  const [end, setEnd] = useState(() => localTime(Date.now() + 30 * 86400000));
  const [total, setTotal] = useState("");
  const [perUser, setPerUser] = useState("1");
  const [conditions, setConditions] = useState("");
  const [stacking, setStacking] = useState(false);
  const [scope, setScope] = useState<"SINGLE" | "GROUP" | "ALL">("SINGLE");
  const [storeId, setStore] = useState(showroom.id);
  const [selected, setSelected] = useState<string[]>([showroom.id]);
  const [search, setSearch] = useState("");
  const [cost, setCost] = useState<"ISSUER" | "REDEEMING_STORE">("ISSUER");
  const [preview, setPreview] = useState<ShowroomCoupon | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const needApproval =
    scope === "ALL" ||
    (scope === "SINGLE"
      ? storeId !== showroom.id
      : selected.some((id) => id !== showroom.id));
  const resetPreview = () => setPreview(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const draft = parseCouponDraft({
        title,
        couponType,
        usageScope: scope,
        storeId,
        allowedStoreIds: selected,
        benefit: {
          kind,
          ...(kind === "ITEM" ? { itemName } : { value: Number(value) }),
          ...(minimum ? { minimumOrder: Number(minimum) } : {}),
          ...(kind === "PERCENT" && maximum
            ? { maximumDiscount: Number(maximum) }
            : {}),
        },
        validFrom: new Date(`${start}+09:00`).toISOString(),
        validUntil: new Date(`${end}+09:00`).toISOString(),
        totalLimit: total ? Number(total) : undefined,
        perUserLimit: Number(perUser),
        conditions,
        allowStacking: stacking,
        costBearer: cost,
      });
      setPreview({
        ...draft,
        id: "preview",
        baristaId: showroom.userId,
        showroomId: showroom.id,
        discountDetail: benefitLabel(draft.benefit),
        policyVersion: 2,
        createdAt: "",
        updatedAt: "",
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "입력 내용을 확인해 주세요.",
      );
    }
  };
  const publish = async () => {
    if (!preview || pending) return;
    setPending(true);
    setError("");
    try {
      onCreated(await addCoupon(parseCouponDraft(preview)));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "등록하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section
      aria-label="쿠폰 만들기"
      className="mt-4 border-y border-[var(--border-strong)] py-6"
    >
      <h3 className="ds-h2">우리 매장만의 혜택 만들기</h3>
      <p className="ds-body-s mt-2 text-[var(--fg-muted)]">
        등록 후 조건은 변경할 수 없어요. 변경이 필요하면 새 쿠폰을 만드세요.
      </p>
      {preview ? (
        <div className="mt-5 space-y-4" aria-label="고객 쿠폰 미리보기">
          <p className="ds-label">고객에게 이렇게 보여요</p>
          <h4 className="ds-h2">{preview.title}</h4>
          <p className="ds-h2 text-[var(--accent)]">{preview.discountDetail}</p>
          <p className="ds-body-s">
            {couponUsageScopeLabel(scope)} ·{" "}
            {scope === "SINGLE"
              ? stores.find((store) => store.id === storeId)?.storeName
              : scope === "GROUP"
                ? `${selected.length}개 매장`
                : "전국 공용 참여 매장"}
          </p>
          <p className="ds-body-s">
            {start.replace("T", " ")} ~ {end.replace("T", " ")} (한국 시간)
          </p>
          <p className="ds-body-s">
            총 {total || "무제한"}
            {total ? "장" : ""} · 고객당 {perUser}장
          </p>
          <CouponTerms coupon={preview} />
          <p className="ds-body-s">
            비용 부담: {cost === "ISSUER" ? "발행 매장" : "사용 매장"}. 자동
            정산·송금은 제공하지 않습니다.
          </p>
          {needApproval ? (
            <p className="ds-body text-[var(--accent)]">
              {scope === "ALL"
                ? "운영자 승인 후 전국 참여 매장에 공개됩니다."
                : "선택한 다른 매장이 모두 동의한 뒤 공개됩니다."}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={resetPreview}
            >
              수정하기
            </Button>
            <Button pending={pending} onClick={() => void publish()}>
              {needApproval ? "참여 승인 요청" : "쿠폰 등록"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-5">
          <PartnerField label="쿠폰 제목">
            <Input
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 오후의 커피 산책"
            />
          </PartnerField>
          <PartnerField label="쿠폰 종류">
            <Select
              value={couponType}
              onChange={(e) => setType(e.target.value as typeof couponType)}
            >
              <option value="regular">일반 혜택</option>
              <option value="timesale">타임세일 · 알림 발송 가능</option>
            </Select>
          </PartnerField>
          <PartnerField label="혜택 유형">
            <Select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setValue(e.target.value === "PERCENT" ? "10" : "1000");
              }}
            >
              <option value="AMOUNT">금액 할인</option>
              <option value="PERCENT">비율 할인</option>
              <option value="ITEM">음료 1잔 제공</option>
            </Select>
          </PartnerField>
          {kind === "ITEM" ? (
            <PartnerField label="제공 메뉴">
              <Input
                required
                maxLength={80}
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="아메리카노"
              />
            </PartnerField>
          ) : (
            <PartnerField
              label={kind === "PERCENT" ? "할인율 (%)" : "할인 금액 (원)"}
            >
              <Input
                type="number"
                min={1}
                max={kind === "PERCENT" ? 100 : 1000000}
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </PartnerField>
          )}
          <PartnerField label="최소 주문 금액 (원)" hint="선택">
            <Input
              type="number"
              min={0}
              max={10000000}
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
              placeholder="제한 없음"
            />
          </PartnerField>
          {kind === "PERCENT" ? (
            <PartnerField label="최대 할인 금액 (원)" hint="선택">
              <Input
                type="number"
                min={1}
                max={1000000}
                value={maximum}
                onChange={(e) => setMaximum(e.target.value)}
                placeholder="제한 없음"
              />
            </PartnerField>
          ) : null}
          <PartnerField label="사용 시작 (한국 시간)">
            <Input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </PartnerField>
          <div className="flex flex-wrap gap-2">
            {[3 / 24, 1, 3, 7, 30].map((days) => (
              <button
                type="button"
                key={days}
                className="ds-body-s rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 py-2"
                onClick={() => {
                  const timestamp = new Date(`${start}+09:00`).getTime();
                  if (Number.isFinite(timestamp))
                    setEnd(localTime(timestamp + days * 86400000));
                  else setError("사용 시작일을 먼저 입력해 주세요.");
                }}
              >
                {days < 1 ? "3시간" : `${days}일`}
              </button>
            ))}
          </div>
          <PartnerField label="사용 종료 (한국 시간)">
            <Input
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </PartnerField>
          <div className="grid grid-cols-2 gap-3">
            <PartnerField label="총 발급 수량" hint="선택">
              <Input
                type="number"
                min={1}
                max={1000000}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="무제한"
              />
            </PartnerField>
            <PartnerField label="고객당 발급 수량">
              <Input
                type="number"
                min={1}
                max={10}
                required
                value={perUser}
                onChange={(e) => setPerUser(e.target.value)}
              />
            </PartnerField>
          </div>
          <PartnerField label="사용처">
            <Select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as typeof scope);
                if (e.target.value === "ALL") setCost("ISSUER");
              }}
            >
              <option value="SINGLE">한 매장 전용</option>
              <option value="GROUP">지정 매장 연합</option>
              <option value="ALL">전국 공용 참여 매장 · 운영자 승인</option>
            </Select>
          </PartnerField>
          {scope === "SINGLE" ? (
            <PartnerField label="사용 매장">
              <Select
                value={storeId}
                onChange={(e) => setStore(e.target.value)}
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                    {store.id === showroom.id
                      ? " (내 매장)"
                      : " · 참여 승인 필요"}
                  </option>
                ))}
              </Select>
            </PartnerField>
          ) : scope === "GROUP" ? (
            <fieldset className="space-y-3">
              <legend className="ds-label mb-3">
                참여를 요청할 매장 ({selected.length}개)
              </legend>
              <Input
                aria-label="연합 매장 검색"
                placeholder="매장 이름으로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-52 overflow-y-auto space-y-3">
                {stores
                  .filter((store) => store.storeName.includes(search))
                  .map((store) => (
                    <label key={store.id} className="ds-body flex gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(store.id)}
                        onChange={(e) =>
                          setSelected((current) =>
                            e.target.checked
                              ? [...current, store.id]
                              : current.filter((id) => id !== store.id),
                          )
                        }
                      />
                      {store.storeName}
                    </label>
                  ))}
              </div>
              <p className="ds-body-s text-[var(--fg-muted)]">
                다른 매장의 참여는 점주 동의 후 확정됩니다.
              </p>
            </fieldset>
          ) : (
            <p className="ds-body-s text-[var(--fg-muted)]">
              운영자 승인 및 전국 공용 참여에 동의한 매장에서만 사용합니다.
            </p>
          )}
          <PartnerField label="할인 비용 부담">
            <Select
              value={cost}
              onChange={(e) => setCost(e.target.value as typeof cost)}
            >
              <option value="ISSUER">발행 매장</option>
              {scope !== "ALL" ? (
                <option value="REDEEMING_STORE">
                  사용 매장 · 해당 점주 동의 필요
                </option>
              ) : null}
            </Select>
          </PartnerField>
          <PartnerField label="대상 메뉴·사용 시간 등 추가 조건" hint="선택">
            <Textarea
              value={conditions}
              maxLength={500}
              onChange={(e) => setConditions(e.target.value)}
              rows={3}
              placeholder="예: 디카페인 제외, 평일 오후 2~5시. 직원이 현장에서 확인합니다."
            />
          </PartnerField>
          <label className="ds-body flex gap-2">
            <input
              type="checkbox"
              checked={stacking}
              onChange={(e) => setStacking(e.target.checked)}
            />
            다른 할인과 중복 사용 가능
          </label>
          <p className="ds-body-s text-[var(--fg-muted)]">
            추가 조건과 주문 금액은 직원이 확인합니다. POS 자동 할인은 제공하지
            않아요.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>
              취소
            </Button>
            <Button type="submit">미리보기</Button>
          </div>
        </form>
      )}
      {error ? (
        <p role="alert" className="ds-body mt-4 text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
