import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "@hengce/domain";
import { selectRunner } from "./select-runner";

describe("SDK 形状与密钥隔离", () => {
  it("cursor-runner 显式 local.cwd，没有 cloud.repos", () => {
    const src = readFileSync(
      join(repoRoot(), "packages", "harness", "src", "cursor-runner.ts"),
      "utf8",
    );
    expect(src).toMatch(/local:\s*\{[^}]*cwd/);
    expect(src).toMatch(/tools:\s*\[\]/);
    expect(src).toMatch(/asyncDispose/);
    expect(src).not.toMatch(/cloud:\s*\{[^}]*repos/);
  });

  it("调度器顺序 await，禁止 Promise.all", () => {
    const src = readFileSync(
      join(repoRoot(), "packages", "harness", "src", "scheduler.ts"),
      "utf8",
    );
    expect(src).toMatch(/await dispatch/);
    expect(src).not.toMatch(/Promise\.all\s*\(/);
    expect(src).not.toMatch(/orchestrate\/plan\.json/);
  });

  it("web-demo 源码不含 SDK 与密钥", () => {
    const dir = join(repoRoot(), "apps", "web-demo", "src");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, name.name);
        if (name.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|jsx)$/.test(name.name)) files.push(p);
      }
    };
    walk(dir);
    const blob = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(blob).not.toMatch(/CURSOR_API_KEY/);
    expect(blob).not.toMatch(/DASHSCOPE_API_KEY/);
    expect(blob).not.toMatch(/@cursor\/sdk/);
    expect(blob).not.toMatch(/\bfetch\s*\(/);
  });

  it("无密钥时 selectRunner 走 scripted", () => {
    const picked = selectRunner({
      CURSOR_API_KEY: "",
      DASHSCOPE_API_KEY: "",
      HENGCE_RUNNER: undefined,
    });
    expect(picked.kind).toBe("scripted");
  });

  it("HENGCE_RUNNER=scripted 即使有密钥也不走云", () => {
    const picked = selectRunner({
      CURSOR_API_KEY: "cursor_test",
      DASHSCOPE_API_KEY: "sk-test",
      HENGCE_RUNNER: "scripted",
    });
    expect(picked.kind).toBe("scripted");
  });

  it("有 DASHSCOPE_API_KEY 时默认走千问", () => {
    const picked = selectRunner({
      DASHSCOPE_API_KEY: "sk-test",
      CURSOR_API_KEY: "cursor_test",
      HENGCE_RUNNER: undefined,
    });
    expect(picked.kind).toBe("qwen");
  });

  it("HENGCE_RUNNER=qwen 缺密钥则抛错", () => {
    expect(() =>
      selectRunner({
        HENGCE_RUNNER: "qwen",
        DASHSCOPE_API_KEY: "",
      }),
    ).toThrow(/DASHSCOPE_API_KEY/);
  });
});
