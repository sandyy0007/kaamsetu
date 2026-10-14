const isProd = process.env.NODE_ENV === "production";

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const isExport = process.env.NEXT_EXPORT === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isExport
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {
        async redirects() {
          return [
            { source: "/landing", destination: "/", permanent: false },
            { source: "/farm", destination: "/farms", permanent: false },
            { source: "/farm/:id", destination: "/farms/:id", permanent: false },
            { source: "/crops/new", destination: "/create?type=crop", permanent: false },
            { source: "/community/:id", destination: "/communities/:id", permanent: false },
          ];
        },
        async headers() {
          const base = [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          ];
          if (isProd) base.push({ key: "Content-Security-Policy", value: csp });
          return [{ source: "/:path*", headers: base }];
        },
      }),
};

export default nextConfig;
