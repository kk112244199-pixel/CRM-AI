import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)));

function collect(dir: string): string {
  let out = "";
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out += collect(p);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) {
      out += readFileSync(p, "utf8");
    }
  }
  return out;
}

describe("R6 前端包无密钥", () => {
  it("apps/web 源码不含 DASHSCOPE_API_KEY、CURSOR_API_KEY、@cursor/sdk、Agent 端口", () => {
    const src = collect(srcDir);
    expect(src).not.toMatch(/CURSOR_API_KEY/);
    expect(src).not.toMatch(/DASHSCOPE_API_KEY/);
    expect(src).not.toMatch(/@cursor\/sdk/);
    expect(src).not.toMatch(/Agent\.create/);
    expect(src).not.toMatch(/cloud:\s*\{\s*repos/);
  });
});

describe("五屏与时间线文案", () => {
  it("App 含五屏与四个展示名", () => {
    const app = readFileSync(join(srcDir, "App.tsx"), "utf8");
    expect(app).toMatch(/线索列表/);
    expect(app).toMatch(/线索详情/);
    expect(app).toMatch(/待确认/);
    expect(app).toMatch(/用量/);
    expect(app).toMatch(/录入/);
    expect(app).toMatch(/系统分配/);
    expect(app).toMatch(/建档/);
    expect(app).toMatch(/商机/);
    expect(app).toMatch(/跟进/);
    expect(app).toMatch(/交卷时间线（主）/);
    expect(app).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("api 只走 /api 且带角色头", () => {
    const api = readFileSync(join(srcDir, "api.ts"), "utf8");
    expect(api).toMatch(/x-hengce-role/);
    expect(api).toMatch(/\/api\/leads\/ingest/);
    expect(api).toMatch(/\/api\/handoffs\//);
    expect(api).toMatch(/\/api\/usage/);
    expect(api).not.toMatch(/CURSOR_API_KEY/);
    expect(api).not.toMatch(/DASHSCOPE_API_KEY/);
  });
});

describe("M6 视觉约束", () => {
  it("样式无 emoji、无紫渐变、有漏斗轨与印泥色", () => {
    const css = readFileSync(join(srcDir, "styles.css"), "utf8");
    expect(css).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(css).not.toMatch(/#7c3aed|#8b5cf6|#a78bfa|purple/i);
    expect(css).toMatch(/--stamp/);
    expect(css).toMatch(/--rail/);
    expect(css).toMatch(/Noto Serif SC/);
  });
});
