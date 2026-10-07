import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint runs as its own gate (npm run lint). Running it inside the build on
    // this workspace forks a second ESLint swarm and OOMs the machine.
    ignoreDuringBuilds: true,
  },
  poweredByHeader: false,
  // Emits a self-contained server bundle, which is what the Docker runtime stage runs.
  output: "standalone",
  // The standalone tracer walks the whole project directory. Anything not needed
  // at runtime is excluded here, which matters because unrelated projects sit
  // alongside Acme Jobs in this workspace and must never be shipped in the
  // deployable bundle.
  outputFileTracingExcludes: {
    "*": [
      "**/acme webite/**",
      "**/acme-webite-whop/**",
      "**/my website/**",
      "**/e2e/**",
      "**/tests/**",
      "**/docs/**",
      "**/scripts/**",
      "**/data/**",
      "**/backups/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/blob-report/**",
      "**/coverage/**",
      "**/.env",
      "**/.env.*",
      "**/*.md",
      "**/*.log",
      "**/qa-screenshots/**",
    ],
  },
  // Migrations and the Prisma schema ship with the bundle because the Dockerfile
  // copies `prisma/` separately. They are deliberately NOT listed here:
  // `outputFileTracingIncludes` makes the tracer walk the whole project
  // directory, which pulled unrelated sibling projects into the output.
  outputFileTracingIncludes: {},
  serverExternalPackages: ["@prisma/client", "pg", "@prisma/adapter-pg"],
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // 'unsafe-inline' is required for Next's own bootstrap scripts because no
          // per-request nonce is issued. React escaping plus the absence of
          // dangerouslySetInnerHTML remain the primary XSS controls.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [];
  },
};

export default nextConfig;
