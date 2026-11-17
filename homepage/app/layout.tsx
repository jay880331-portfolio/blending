import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLENDING — 더 좋은 커피 경험을 연결합니다",
  description:
    "BLENDING은 커피를 좋아하는 사람들이 발견하고, 배우고, 연결되는 경험을 만듭니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
