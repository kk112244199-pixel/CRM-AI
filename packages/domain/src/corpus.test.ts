import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANY_NAMES, DOCUMENT_KINDS, corpusDir, writeCorpusFiles } from "../src/index";

describe("语料同宇宙 Q5", () => {
  it("八个目录各五类文件，能 grep 到八个公司全名，无 emoji", () => {
    const dir = writeCorpusFiles();
    const slugs = readdirSync(dir).filter((n) => !n.startsWith("."));
    expect(slugs.sort()).toEqual(
      [
        "hangchi",
        "jiaxing",
        "chenghai",
        "chengguo",
        "linli",
        "yedeng",
        "haitu",
        "jiangdong",
      ].sort(),
    );

    let blob = "";
    for (const slug of slugs) {
      const files = readdirSync(join(dir, slug));
      for (const kind of DOCUMENT_KINDS) {
        expect(files).toContain(`${kind}.md`);
        blob += readFileSync(join(corpusDir(), slug, `${kind}.md`), "utf8");
      }
    }
    for (const name of COMPANY_NAMES) {
      expect(blob).toContain(name);
    }
    expect(blob).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(blob).not.toMatch(/\b\d{17}[\dXx]\b/);
    expect(blob).not.toMatch(/CURSOR_API_KEY/);
    expect(blob).not.toMatch(/DASHSCOPE_API_KEY/);
  });
});
