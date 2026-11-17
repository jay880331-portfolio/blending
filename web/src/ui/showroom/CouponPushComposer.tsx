"use client";
import { useState } from "react";
import type { ShowroomCoupon } from "@/domain/showroom/types";
import {
  previewCouponPush,
  sendCouponPush,
  fetchCouponPushRun,
  type CouponPushAudience,
  type CouponPushRun,
} from "@/adapters/http/showroomApi";
import { Button } from "@/ui/shared/Button";
import { PartnerField } from "@/ui/shared/Field";
import { Input, Select, Textarea } from "@/ui/shared/Input";

const templates = [
  {
    title: "[오후의 커피] 잠깐 쉬어 가세요",
    body: "지금 방문하시면 준비한 커피 혜택을 드립니다.",
  },
  {
    title: "[오늘의 혜택] 반가운 한 잔",
    body: "오늘의 특별한 쿠폰을 확인하고 매장에서 사용해 보세요.",
  },
  {
    title: "[바리스타 초대] 커피 한 잔 어떠세요?",
    body: "추천 커피와 함께 즐길 수 있는 혜택을 준비했습니다.",
  },
];
export function CouponPushComposer({
  coupon,
  onSent,
  onClose,
}: {
  coupon: ShowroomCoupon;
  onSent: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(`[타임세일] ${coupon.title}`.slice(0, 60));
  const [body, setBody] = useState(coupon.discountDetail.slice(0, 200));
  const [audience, setAudience] = useState<CouponPushAudience>("regulars");
  const [count, setCount] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [run, setRun] = useState<CouponPushRun | null>(null);
  const preview = async () => {
    setPending(true);
    setError("");
    try {
      setCount(
        (await previewCouponPush(coupon.id, title, body, audience))
          .recipientCount,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "대상을 확인하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  };
  const send = async () => {
    if (count == null || count === 0 || pending) return;
    setPending(true);
    setError("");
    try {
      const sent = await sendCouponPush(coupon.id, title, body, audience);
      setResult(sent.message);
      setCount(null);
      onSent();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "발송하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  };
  const refresh = async () => {
    setPending(true);
    try {
      setRun((await fetchCouponPushRun(coupon.id)).run);
    } catch {
      setError("결과를 불러오지 못했습니다.");
    } finally {
      setPending(false);
    }
  };
  return (
    <section
      aria-label="쿠폰 알림 편집"
      className="mt-5 space-y-4 border-t border-[var(--border-strong)] pt-5"
    >
      <h4 className="ds-h3">알림 만들기</h4>
      <p className="ds-body-s text-[var(--fg-muted)]">
        마케팅 수신 동의 고객에게만 발송해요. 주변 고객은 위치 공유 동의와 최근
        24시간 내 3km 위치 기록도 필요합니다. 고객당 전체 매장 합산 24시간에
        1회, 같은 쿠폰은 1시간 간격입니다.
      </p>
      <PartnerField label="추천 문구">
        <Select
          defaultValue=""
          onChange={(e) => {
            const preset = templates[Number(e.target.value)];
            if (preset) {
              setTitle(preset.title);
              setBody(preset.body);
              setCount(null);
            }
          }}
        >
          <option value="" disabled>
            문구를 골라 자유롭게 수정하세요
          </option>
          {templates.map((template, index) => (
            <option key={template.title} value={index}>
              {template.title}
            </option>
          ))}
        </Select>
      </PartnerField>
      <PartnerField label="발송 대상">
        <Select
          value={audience}
          onChange={(e) => {
            setAudience(e.target.value as CouponPushAudience);
            setCount(null);
          }}
        >
          <option value="regulars">내 바리스타를 즐겨찾기한 고객</option>
          <option value="nearby">매장 주변 3km 고객</option>
          <option value="both">즐겨찾기 + 주변 고객</option>
        </Select>
      </PartnerField>
      <PartnerField label="알림 제목" hint="최대 60자">
        <Input
          value={title}
          maxLength={60}
          onChange={(e) => {
            setTitle(e.target.value);
            setCount(null);
          }}
        />
      </PartnerField>
      <PartnerField label="알림 내용" hint="최대 200자">
        <Textarea
          value={body}
          maxLength={200}
          rows={3}
          onChange={(e) => {
            setBody(e.target.value);
            setCount(null);
          }}
        />
      </PartnerField>
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] p-4"
        aria-label="알림 미리보기"
      >
        <p className="ds-label text-[var(--fg-muted)]">BLENDING</p>
        <p className="ds-h3 mt-2">{title}</p>
        <p className="ds-body mt-1">{body}</p>
        <p className="ds-body-s mt-3 text-[var(--fg-muted)]">
          누르면 해당 매장의 쿠폰으로 이동합니다.
        </p>
      </div>
      {count != null ? (
        <p role="status" className="ds-body">
          현재 발송 가능 대상 {count}명. 발송 직전에 동의와 간격을 다시
          확인합니다.
        </p>
      ) : null}
      {result ? (
        <p role="status" className="ds-body">
          {result}
        </p>
      ) : null}
      {run ? (
        <p className="ds-body-s">
          최근 발송: 대상 {run.targetCount}명 · 전송 접수 {run.acceptedCount}건
          · 실패 {run.failedCount}건 · 제외 {run.suppressedCount}명.{" "}
          {run.receiptAcceptedCount == null
            ? "APNs/FCM 전달 결과는 발송 15분 후 다시 확인하세요."
            : `APNs/FCM 전달 ${run.receiptAcceptedCount}건 · 실패 ${run.receiptFailedCount}건 · 확인 대기 ${run.receiptPendingCount}건.`}{" "}
          고객의 표시·열람 여부는 확인할 수 없습니다.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="ds-body text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" disabled={pending} onClick={onClose}>
          닫기
        </Button>
        <Button
          variant="secondary"
          pending={pending}
          onClick={() => void refresh()}
        >
          최근 발송 결과
        </Button>
        {count == null ? (
          <Button
            pending={pending}
            disabled={!title.trim() || !body.trim()}
            onClick={() => void preview()}
          >
            대상 확인
          </Button>
        ) : (
          <Button
            pending={pending}
            disabled={!count}
            onClick={() => void send()}
          >
            푸시 발송 확정
          </Button>
        )}
      </div>
    </section>
  );
}
