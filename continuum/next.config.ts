import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=true builds a fully static site (GitHub Pages). API routes
 * are not available there; the app falls back to its on-device engines.
 * BASE_PATH is the sub-path the site is served from, e.g. "/MosaicWellness".
 */
const staticExport = process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = staticExport
  ? { output: "export", basePath: process.env.BASE_PATH || undefined, images: { unoptimized: true } }
  : {};

export default nextConfig;
