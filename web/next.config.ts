import type { NextConfig } from "next";
import os from "node:os";
import path from "node:path";
import { DAILY_NOTE_IMAGE_HOSTNAMES } from "./src/domain/daily-note/dailyNoteImageUrl";

function localDevOrigins() {
  return Object.values(os.networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter(
      (address) =>
        address.family === "IPv4" &&
        !address.internal &&
        !address.address.startsWith("169.254."),
    )
    .map((address) => address.address);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "unmocking-uncontrite-berna.ngrok-free.dev",
    ...localDevOrigins(),
  ],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**.kakaocdn.net" },
      { protocol: "https", hostname: "**.kakaocdn.net" },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "ssl.pstatic.net",
      },
      {
        protocol: "https",
        hostname: "appleid.cdn-apple.com",
      },
      ...DAILY_NOTE_IMAGE_HOSTNAMES.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
    ],
  },
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
