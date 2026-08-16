import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function collectTs(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out += collectTs(p);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) {
      out += readFileSync(p, "utf8");
    }
  }
  return out;
}

describe("无后端约束", () => {
  it("业务源码不含 fetch、WebSocket、cursor sdk", () => {
    const src = collectTs(root);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/WebSocket/);
    expect(src).not.toMatch(/@cursor\/sdk/);
    expect(src).not.toMatch(/localhost:\d+/);
  });
});
