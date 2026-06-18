// NOTE: Next.js 14 does not support next.config.ts (TypeScript configs landed in
// Next 15) — a .ts config would be silently ignored, so this file is .mjs.
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure prompts/system.md is bundled into the Vercel serverless function
    // for the vision route, since it is read with fs at runtime.
    outputFileTracingIncludes: {
      "/api/vision": ["./prompts/**/*"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // Explicitly grant camera access to this origin (and deny mic).
            key: "Permissions-Policy",
            value: "camera=(self), microphone=()",
          },
          {
            // 'unsafe-eval'/'unsafe-inline' + ws: are required for Next.js dev
            // mode (React Refresh / HMR). media-src blob: allows the camera
            // MediaStream to render in the <video> element.
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' ws: wss:; font-src 'self' data:; worker-src 'self' blob:; manifest-src 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
