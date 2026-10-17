import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
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

/**
 * A short fingerprint of the app icons. The icon links carry it, so a changed
 * icon gets a new address and Safari and iOS cannot keep showing the old one.
 */
function iconVersion(): string {
  const hash = createHash("sha256");
  for (const file of ["public/apple-touch-icon.png", "src/app/icon.png"]) {
    hash.update(readFileSync(path.join(process.cwd(), file)));
  }
  return hash.digest("hex").slice(0, 8);
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: { RECORDINGS: recordings(), ICON_VERSION: iconVersion() },
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
