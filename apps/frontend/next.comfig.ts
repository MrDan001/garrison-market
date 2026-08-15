// FILE: apps/frontend/next.config.ts
//
// SECURITY (Stage 4 — session/access audit): this file did not exist here
// before. There WAS a next.config.js, but it sat at the monorepo root
// (garrison-market-main/next.config.js) instead of inside apps/frontend/,
// which is where Vercel's build root actually is for this project. Next.js
// only reads a config file from the project root it's building — so that
// file was never loaded in production at all. That means two things were
// silently not happening, not just "no security headers":
//   1. No headers of any kind were being sent — no CSP, no
//      X-Frame-Options, no HSTS, no X-Content-Type-Options. The app was
//      clickjacking-able and had no injected-script mitigation.
//   2. The settings that WERE in that orphaned file — the Vercel Blob
//      image remotePattern and the 10mb server-action body size limit —
//      were also not actually in effect. If image optimization for blob
//      photos or large uploads happened to be working, it was despite
//      this file, not because of it (Next.js fails open on unrecognized
//      remote image hosts by refusing to optimize them, and the default
//      server action body limit is 1mb). Both settings are ported over
//      here unchanged, now in the place Next.js actually reads.
//
// CSP notes — read before changing script-src/style-src:
//   - script-src includes 'unsafe-inline' because of the inline
//     <script id="theme-anti-flash"> in app/theme-anti-flash.tsx, which
//     runs on every single page (root layout) to prevent a dark-mode
//     flash on load. Without 'unsafe-inline' here, that script is
//     silently blocked by the browser and dark mode flashes wrong on
//     every load — not a crash, just a visible regression that's easy to
//     miss in testing if you don't have a dark-mode preference set.
//   - style-src includes 'unsafe-inline' because ~29 files use React's
//     style={{...}} prop, which renders as inline style="" attributes.
//   - Known, deliberate trade-off: 'unsafe-inline' on script-src means
//     this CSP does NOT stop an injected inline <script> from executing
//     if an XSS payload ever got into the page some other way. It still
//     blocks the far more common exploitation path — loading a script
//     or connecting to an *external* attacker-controlled domain — and
//     it's a large improvement over the zero headers that existed
//     before. Closing this specific gap requires a nonce-based CSP
//     (generating a per-request nonce and threading it through the
//     inline script tag and every header), which is a separate, larger
//     change than this stage covers.
//   - img-src and connect-src both need the Vercel Blob hostname, for two
//     different reasons: img-src so <img>/next/image can display photos
//     stored there, and connect-src because @vercel/blob/client's
//     upload() function (used in AddInventoryForm, ProfileEditForm, and
//     others) uploads the file bytes directly from the browser to Blob
//     storage — that's a fetch/XHR the browser makes on its own, which
//     connect-src (not img-src) governs. Missing connect-src here would
//     silently break every photo upload while looking completely
//     unrelated to CSP in the error console.

import type { NextConfig } from "next";
import path from "path";

const BLOB_HOSTNAME = "fg3uwdlr4t2605wl.public.blob.vercel-storage.com";

const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https://${BLOB_HOSTNAME}`,
  `font-src 'self' data:`,
  `connect-src 'self' https://${BLOB_HOSTNAME}`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  // Belt-and-suspenders alongside frame-ancestors above — CSP's
  // frame-ancestors is what modern browsers actually honor, but
  // X-Frame-Options covers older clients that don't read CSP for framing.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 2 years, applies to subdomains. Left off "preload" deliberately —
  // submitting to the browser preload list is effectively permanent
  // (removal takes months to propagate) and affects every subdomain of
  // gmstock.co, not just this app. Add "; preload" yourself once you're
  // sure every subdomain you have or will ever add is HTTPS-only.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Conservative and narrow on purpose: only disables hardware/sensor
  // APIs nothing in this codebase uses (checked — no camera, mic,
  // geolocation, USB, or Payment Request API usage anywhere). Push
  // notifications are unaffected — that's a separate browser permission,
  // not something Permissions-Policy gates.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), usb=(), gyroscope=(), magnetometer=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: BLOB_HOSTNAME,
        port: "",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    // apps/frontend has its own lockfile alongside one at the monorepo
    // root — being explicit here avoids Turbopack guessing wrong between
    // the two and prevents a "multiple lockfiles" warning.
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;