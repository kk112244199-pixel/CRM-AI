import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPANY_SLUGS,
  DOCUMENT_KINDS,
  bootstrapMemoryDb,
  closeDb,
  corpusDir,
  documents,
} from "@hengce/domain";
import {
  extractCitations,
  listCorpusRelPaths,
  missingCitations,
} from "./citations";

describe("Q8 引用须能指到语料文件名", () => {
  it("8 家 × 五类文件都在磁盘上", () => {
    const rels = listCorpusRelPaths();
    expect(rels).toHaveLength(40);
    const dir = corpusDir();
    for (const rel of rels) {
      expect(existsSync(join(dir, ...rel.split("/")))).toBe(true);
    }
  });

  it("种子 documents.filename 能对上 corpus", () => {
    const opened = bootstrapMemoryDb();
    const rows = opened.db.select().from(documents).all();
    expect(rows.length).toBe(40);
    const dir = corpusDir();
    for (const row of rows) {
      expect(DOCUMENT_KINDS).toContain(row.kind);
      expect(COMPANY_SLUGS).toContain(row.slug);
      expect(row.filename).toBe(`${row.kind}.md`);
      expect(existsSync(join(dir, row.slug, row.filename))).toBe(true);
    }
    closeDb(opened.sqlite);
  });

  it("真引用通过，幻觉文件名失败", () => {
    expect(extractCitations("见 hangchi/handbook.md 与 email.md")).toEqual(
      expect.arrayContaining(["hangchi/handbook.md", "email.md"]),
    );
    const ok = missingCitations("对照 hangchi/email.md");
    expect(ok.every((c) => c.ok)).toBe(true);
    const bad = missingCitations(
      "引用 hangchi/discovery.md 与 fake/win-or-loss-case.md 以及 Discovery.md",
    );
    expect(bad.some((c) => !c.ok)).toBe(true);
    expect(bad.filter((c) => !c.ok).map((c) => c.cited)).toEqual(
      expect.arrayContaining([
        "hangchi/discovery.md",
        "fake/win-or-loss-case.md",
        "discovery.md",
      ]),
    );
  });
});
