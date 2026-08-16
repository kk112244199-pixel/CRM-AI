import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { bootstrapMemoryDb, closeDb } from "../../domain/src/index";
import { searchSimilar } from "../src/search-similar";

const opened = bootstrapMemoryDb();
afterAll(() => closeDb(opened.sqlite));

describe("searchSimilar Q6", () => {
  it("杭齿精密机电第一名是嘉兴精工装备", () => {
    const hits = searchSimilar(opened.sqlite, "杭齿精密机电");
    expect(hits[0]?.company).toBe("嘉兴精工装备");
  });

  it("海图进出口第一名不得是杭齿精密机电", () => {
    const hits = searchSimilar(opened.sqlite, "海图进出口");
    expect(hits[0]?.company).not.toBe("杭齿精密机电");
    expect(hits.map((h) => h.company)).not.toContain("海图进出口");
  });

  it("邻里鲜超市第一名是夜灯便利", () => {
    const hits = searchSimilar(opened.sqlite, "邻里鲜超市");
    expect(hits[0]?.company).toBe("夜灯便利");
  });
});

describe("S9 sqlite-vec", () => {
  it("走 vec_leads MATCH，不是标签重叠", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "search-similar.ts"),
      "utf8",
    );
    expect(src).toMatch(/vec_leads/);
    expect(src).toMatch(/MATCH/);
    expect(src).not.toMatch(/overlap\(/);
    expect(src).not.toMatch(/search_tags AS searchTags/);
  });

  it("vec_leads 有八家且扩展已加载", () => {
    const v = opened.sqlite.prepare("SELECT vec_version() AS v").get() as {
      v: string;
    };
    expect(v.v).toMatch(/^v0\./);
    const n = opened.sqlite
      .prepare("SELECT COUNT(*) AS n FROM vec_leads")
      .get() as { n: number };
    expect(n.n).toBe(8);
  });
});
