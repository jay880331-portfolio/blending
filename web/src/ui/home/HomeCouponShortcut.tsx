"use client";

import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { fetchUserCoupons } from "@/adapters/http/showroomApi";
import { isUserCouponUsable } from "@/domain/showroom/couponStatus";
import { HomeShortcutRow } from "@/ui/home/HomeShortcutRow";

export function HomeCouponShortcut() {
  const [label, setLabel] = useState("확인 중");
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const { userCoupons } = await fetchUserCoupons();
        const now = new Date();
        const count = userCoupons.filter((coupon) =>
          isUserCouponUsable(coupon, now),
        ).length;
        if (active && request === sequence) setLabel(`사용 가능 ${count}장`);
      } catch {
        if (active && request === sequence) setLabel("쿠폰함 보기");
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return (
    <HomeShortcutRow
      href="/showroom/coupons"
      icon={<Ticket size={24} aria-hidden="true" />}
      title="내 쿠폰"
      subtitle={label}
    />
  );
}
