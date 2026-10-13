import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * The narrator recordings that exist, as a comma-separated list of file
 * names. Empty files are the placeholders and do not count. Read once when
 * the build or the dev server starts, so the app never asks for a missing file.
 */
function recordings(): string {
  const folder = path.join(process.cwd(), "public/audio/sprache");
  try {
    return readdirSync(folder)
      .filter((file) => !file.startsWith(".") && statSync(path.join(folder, file)).size >= 512)
      .join(",");
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: { RECORDINGS: recordings() },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
