import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readVersion } from "../src/version.js";

describe("readVersion", () => {
  it("matches the repo package.json version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
    expect(readVersion()).toBe(pkg.version);
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("reads the version from a given package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "ct-ver-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "9.8.7" }));
    expect(readVersion(new URL(`file://${join(dir, "package.json")}`))).toBe("9.8.7");
  });
});
