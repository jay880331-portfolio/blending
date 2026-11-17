"use client";

import { QrCode } from "@/ui/shared/QrCode";
import { profileQrUrl } from "./profileQrUrl";
export { loadQrious } from "@/ui/shared/QrCode";

export function ProfileQrCode({
  profileId,
  size = 104,
}: {
  profileId: string;
  size?: number;
}) {
  return (
    <QrCode
      value={(origin) => profileQrUrl(origin, profileId)}
      label="프로필 QR 코드"
      size={size}
    />
  );
}
