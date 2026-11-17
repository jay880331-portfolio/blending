import type { Metadata, Viewport } from "next";
import { AppVersionGate } from "@/ui/shared/AppVersionGate";
import { AppPopupHost } from "@/ui/shared/AppPopupHost";
import { GlobalZoomGuard } from "@/ui/shared/GlobalZoomGuard";
import { GlobalLoadingBar } from "@/ui/shared/GlobalLoadingBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLENDING",
  description: "BLENDING community and partner lounge screens",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <GlobalZoomGuard />
        <GlobalLoadingBar />
        <AppVersionGate />
        <AppPopupHost />
        {children}
      </body>
    </html>
  );
}
