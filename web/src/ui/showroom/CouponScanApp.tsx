"use client";
import { useEffect, useState, useRef } from "react";
import type {
  CouponStore,
  ShowroomCoupon,
  UserCoupon,
} from "@/domain/showroom/types";
import { CheckCircle2 } from "lucide-react";
import { parseCustomerQr } from "@/domain/showroom/customerQr";
import { parsePassportQr } from "@/domain/passport/passportQr";
import type { PassportScanConfirmResult } from "@/domain/passport/types";
import { Button } from "@/ui/shared/Button";
import { Select } from "@/ui/shared/Input";
import { QrScanner } from "@/ui/shared/QrScanner";
import { ShowroomHeader } from "./ShowroomHeader";
import { BottomNav } from "@/ui/shared/BottomNav";
import { CouponTerms } from "./CouponTerms";
import { CouponReceipt } from "./CouponReceipt";
import { readCouponResponse as couponJson } from "@/adapters/http/showroomApi";
import { couponUsageScopeLabel } from "@/domain/showroom/couponStatus";

export function CouponScanApp() {
  const [stores, setStores] = useState<CouponStore[]>([]),
    [storeId, setStoreId] = useState("");
  const [loading, setLoading] = useState(true),
    [scanning, setScanning] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [offer, setOffer] = useState<{
    token: string;
    coupon: ShowroomCoupon;
    store: CouponStore;
  } | null>(null);
  const [passportOffer, setPassportOffer] = useState<{
    token: string;
    purpose: "STAMP" | "REDEEM";
    storeName: string;
    customerName: string;
    points: number;
    menuName?: string;
  } | null>(null);
  const [receipt, setReceipt] = useState<UserCoupon | null>(null);
  const [passportReceipt, setPassportReceipt] =
    useState<PassportScanConfirmResult | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let canceled = false;
    void fetch("/api/showroom/coupon-scan", { cache: "no-store" })
      .then(couponJson<{ stores: CouponStore[] }>)
      .then((data) => {
        if (!canceled) {
          setStores(data.stores);
          setStoreId(data.stores[0]?.id ?? "");
        }
      })
      .catch((f) => {
        if (!canceled) setError(f.message);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
    };
  }, []);
  const request = async (action: "inspect" | "redeem", token: string) =>
    couponJson<{
      coupon: ShowroomCoupon;
      store: CouponStore;
      userCoupon: UserCoupon;
    }>(
      await fetch("/api/showroom/coupon-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token, storeId }),
      }),
    );
  const scan = async (value: string) => {
    if (lock.current) return;
    lock.current = true;
    setScanning(false);
    setError("");
    setBusy(true);
    try {
      const couponToken = parseCustomerQr(value);
      if (couponToken) {
        const data = await request("inspect", couponToken);
        setOffer({
          token: couponToken,
          coupon: data.coupon,
          store: data.store,
        });
        return;
      }
      const passportToken = parsePassportQr(value);
      if (passportToken) {
        const data = await couponJson<{
          purpose: "STAMP" | "REDEEM";
          storeName: string;
          customerName: string;
          points: number;
          menuName?: string;
        }>(
          await fetch("/api/passport/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: passportToken, storeId }),
          }),
        );
        setPassportOffer({ token: passportToken, ...data });
        return;
      }
      throw new Error("고객의 블렌딩 쿠폰 또는 여권 QR을 스캔해 주세요.");
    } catch (f) {
      setError(f instanceof Error ? f.message : "QR을 확인하지 못했습니다.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const confirmPassport = async () => {
    if (!passportOffer || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await couponJson<PassportScanConfirmResult>(
        await fetch("/api/passport/scan/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: passportOffer.token, storeId }),
        }),
      );
      setPassportReceipt(result);
      setPassportOffer(null);
    } catch (f) {
      setError(
        f instanceof Error ? f.message : "처리 결과를 확인하지 못했습니다.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const redeem = async () => {
    if (!offer || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request("redeem", offer.token);
      setReceipt({ ...result.userCoupon, coupon: result.coupon });
      setOffer(null);
    } catch (f) {
      setError(
        f instanceof Error ? f.message : "처리 결과를 확인하지 못했습니다.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-[var(--bg)] pb-32 text-[var(--fg)]">
      <ShowroomHeader
        title="직원 쿠폰 스캔"
        backHref="/showroom/manage"
        showCouponLink={false}
      />
      {receipt ? (
        <CouponReceipt
          coupon={receipt}
          staff
          onClose={() => {
            setReceipt(null);
            setScanning(true);
          }}
        />
      ) : passportReceipt ? (
        <section aria-label="여권 처리 완료" className="space-y-5 px-6 py-8">
          <CheckCircle2
            size={40}
            className="text-[var(--success)]"
            aria-hidden="true"
          />
          <h2 className="ds-display-m">
            {passportReceipt.purpose === "STAMP"
              ? "스탬프 적립 완료"
              : "음료 교환 완료"}
          </h2>
          <p className="ds-h2">
            {passportReceipt.purpose === "STAMP"
              ? `+${passportReceipt.points}P`
              : `${passportReceipt.menuName} (-${passportReceipt.points.toLocaleString("ko-KR")}P)`}
          </p>
          <p className="ds-body">{passportReceipt.storeName}</p>
          <dl className="ds-body-s space-y-3 border-y border-[var(--border-strong)] py-5">
            <div>
              <dt>처리 일시</dt>
              <dd>
                {new Date(passportReceipt.createdAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </dd>
            </div>
            <div>
              <dt>사용 번호</dt>
              <dd className="break-all">
                {passportReceipt.purpose === "STAMP"
                  ? passportReceipt.stampId
                  : passportReceipt.redeemId}
              </dd>
            </div>
          </dl>
          <Button
            onClick={() => {
              setPassportReceipt(null);
              setScanning(true);
            }}
          >
            다음 고객 스캔
          </Button>
        </section>
      ) : (
        <section className="space-y-6 px-6 py-8">
          <h1 className="ds-display-m">고객 QR을 비춰 주세요</h1>
          <p className="ds-body text-[var(--fg-muted)]">
            쿠폰 조건을 확인하고 적용하면 고객 화면도 완료로 바뀝니다.
          </p>
          {stores.length ? (
            <label className="ds-body block">
              처리 매장
              <Select
                aria-label="처리 매장"
                disabled={busy || !!offer || !!passportOffer || scanning}
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  setOffer(null);
                  setPassportOffer(null);
                }}
                className="mt-2 w-full"
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <p role="status">
              {loading
                ? "매장을 불러오는 중…"
                : "처리 권한이 있는 매장이 없습니다. 쇼룸 관리자에게 직원 등록을 요청해 주세요."}
            </p>
          )}
          {scanning ? (
            <QrScanner
              title="고객 쿠폰·여권 QR을 비춰 주세요"
              onScan={(v) => void scan(v)}
              onClose={() => setScanning(false)}
            />
          ) : passportOffer ? (
            <article className="space-y-5 border-y border-[var(--border-strong)] py-6">
              <p className="ds-label">
                {passportOffer.storeName} · {passportOffer.customerName}
              </p>
              <h2 className="ds-h2">
                {passportOffer.purpose === "STAMP"
                  ? "스탬프 적립 +100P"
                  : `${passportOffer.menuName ?? "음료 교환"} · -${passportOffer.points.toLocaleString("ko-KR")}P`}
              </h2>
              <p className="ds-body-s text-[var(--fg-muted)]">
                {passportOffer.purpose === "STAMP"
                  ? "확정을 누르면 고객에게 스탬프 1회와 100P가 적립됩니다."
                  : "음료 교환을 확정하고 포인트를 차감합니다."}
              </p>
              <Button pending={busy} onClick={() => void confirmPassport()}>
                확정
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setPassportOffer(null);
                  setScanning(true);
                  setError("");
                }}
              >
                다른 QR 스캔
              </Button>
            </article>
          ) : offer ? (
            <article className="space-y-5 border-y border-[var(--border-strong)] py-6">
              <p className="ds-label">
                {offer.store.storeName} ·{" "}
                {couponUsageScopeLabel(offer.coupon.usageScope)}
              </p>
              <h2 className="ds-h2">{offer.coupon.title}</h2>
              <p className="ds-display-m">{offer.coupon.discountDetail}</p>
              <CouponTerms coupon={offer.coupon} />
              <p className="ds-body-s text-[var(--fg-muted)]">
                주문 조건을 확인해 주세요. 완료 후 표시되는 혜택을 POS에
                반영합니다.
              </p>
              <Button pending={busy} onClick={() => void redeem()}>
                할인 적용 완료
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setOffer(null);
                  setScanning(true);
                  setError("");
                }}
              >
                다른 QR 스캔
              </Button>
            </article>
          ) : (
            <Button
              disabled={!storeId || loading}
              pending={busy}
              onClick={() => {
                setError("");
                setScanning(true);
              }}
            >
              고객 QR 스캔
            </Button>
          )}
          {error ? (
            <p role="alert" className="ds-body text-[var(--danger)]">
              {error}
            </p>
          ) : null}
        </section>
      )}
      <BottomNav active="mypage" />
    </main>
  );
}
