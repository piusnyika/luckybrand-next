import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // set in the Dockerfile; `npm start` needs the normal output
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // WordPress URLs end with a slash; keep them identical for SEO.
  trailingSlash: true,
  images: {
    localPatterns: [{ pathname: "/uploads/**" }],
    formats: ["image/webp"],
    // every width is listed on every image, so keep the list short
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [96, 256, 384],
  },
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/icons.svg", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] }, { source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" }, // browsers only act on it over https
    ] }];
  },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
