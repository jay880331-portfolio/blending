import type { NextConfig } from "next";
import path from "node:path";

const webOrigin =
  process.env.NEXT_PUBLIC_WEB_ORIGIN ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  async headers() { return [{ source: "/(.*)", headers: [
    { key: "Content-Security-Policy", value: `frame-ancestors 'none'; connect-src 'self' ${webOrigin}` },
    { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Content-Type-Options", value: "nosniff" },
  ] }]; },
};

export default nextConfig;
