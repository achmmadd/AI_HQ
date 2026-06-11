import { approvalsCoworkRedirect } from "./app/cowork/middleware.mjs";

/** @type {import('next').NextConfig} */
const embedExtra = (process.env.EMBED_FRAME_ANCESTORS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .join(" ");

/** Extra hosts (tunnel / LAN / preview) die in dev naar poort 3040 proxy’en — anders blokkeert Next 16 /_next/* (lege site). */
const allowedDevOrigins = [
  "motorsai.app",
  "*.motorsai.app",
  "fumero.nl",
  "*.fumero.nl",
  ...(process.env.NEXT_DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3", "playwright", "pdfkit", "postgres"],
  allowedDevOrigins,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/qdrant/search",
          destination: "/api/knowledge/qdrant-search",
        },
        {
          source: "/api/content/generate",
          destination: "/api/fumero/content/generate",
        },
      ],
    };
  },
  async redirects() {
    return [
      {
        source: "/fumero/workspace",
        destination: "/fumero",
        permanent: false,
      },
      {
        source: "/fumero/content",
        destination: "/fumero/chat",
        permanent: true,
      },
      {
        source: "/fumero/marketing",
        destination: "/fumero/automations",
        permanent: true,
      },
      {
        source: "/fumero/email",
        destination: "/fumero/automations",
        permanent: true,
      },
      {
        source: "/fumero/apps",
        destination: "/fumero/projecten",
        permanent: true,
      },
      {
        source: "/fumero/tools",
        destination: "/fumero/projecten",
        permanent: true,
      },
      {
        source: "/fumero/studio",
        destination: "/fumero/photo-studio",
        permanent: false,
      },
      {
        source: "/fumero/chat",
        has: [{ type: "query", key: "mode", value: "coder" }],
        destination: "/fumero/bouwen",
        permanent: false,
      },
      approvalsCoworkRedirect,
    ];
  },
  async headers() {
    const frameAncestors = [
      "'self'",
      "https://fumero.nl",
      "https://www.fumero.nl",
      "http://127.0.0.1:3040",
      "http://localhost:3040",
      ...(embedExtra ? embedExtra.split(/\s+/) : []),
    ].join(" ");

    return [
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
