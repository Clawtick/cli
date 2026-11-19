import { readFileSync } from "node:fs";

/**
 * Read the package version from package.json at runtime.
 * ../package.json resolves from both src/ (tsx, vitest) and dist/ (tsc output).
 */
export function readVersion(pkgUrl: URL = new URL("../package.json", import.meta.url)): string {
  return JSON.parse(readFileSync(pkgUrl, "utf-8")).version;
}
