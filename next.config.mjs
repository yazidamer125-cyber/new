/** @type {import('next').NextConfig} */

// Security headers. CSP notes:
// - script-src needs 'unsafe-inline' for Next.js hydration payloads (no nonce
//   infrastructure yet — tracked as a hardening TODO; everything else is strict).
// - 'unsafe-eval' is required by React refresh in development only.
// - img/media/connect allow https: because worker photos/videos and uploads go
//   directly to short-lived signed Cloudflare R2 URLs on a per-account domain.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Belt-and-braces: even if a crawler reaches an authenticated path,
      // it must never be indexed.
      {
        source: "/(workers|job-orders|proposals|placements|admin|onboarding|notifications|messages|dashboard)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
