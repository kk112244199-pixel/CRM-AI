import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "@hengce/domain";

const NAMES = [
  "orchestrator",
  "lead-intake",
  "pipeline",
  "followup",
] as const;

function parseFrontmatter(md: string): {
  name: string;
  description: string;
  tools: string[];
} {
  const block = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) throw new Error("缺少 frontmatter");
  const raw = block[1] ?? "";
  const name = raw.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const description =
    raw.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const toolsLine = raw.match(/^tools:\s*(\[[\s\S]*?\])/m)?.[1];
  if (!toolsLine) throw new Error("缺少 tools");
  const tools = JSON.parse(toolsLine.replace(/,\s*]/, "]")) as string[];
  return { name, description, tools };
}

describe("runtime/agents S4", () => {
  const dir = join(repoRoot(), "runtime", "agents");

  it("四份文件在 runtime/agents，不在 .cursor/agents", () => {
    for (const name of NAMES) {
      expect(existsSync(join(dir, `${name}.md`))).toBe(true);
      expect(
        existsSync(join(repoRoot(), ".cursor", "agents", `${name}.md`)),
      ).toBe(false);
    }
  });

  it("frontmatter 含 name、When to invoke、且 tools 互不相同", () => {
    const toolSets: string[] = [];
    for (const name of NAMES) {
      const md = readFileSync(join(dir, `${name}.md`), "utf8");
      const fm = parseFrontmatter(md);
      expect(fm.name).toBe(name);
      expect(fm.description.toLowerCase()).toMatch(/when to invoke/);
      expect(md).toMatch(/## When to invoke/);
      expect(md).toMatch(/## 禁区/);
      expect(fm.tools.length).toBeGreaterThan(0);
      toolSets.push([...fm.tools].sort().join("|"));
    }
    expect(new Set(toolSets).size).toBe(4);
  });

  it("orchestrator 是系统分配，不自称销冠", () => {
    const md = readFileSync(join(dir, "orchestrator.md"), "utf8");
    expect(md).toMatch(/系统分配/);
    expect(md).toMatch(/不是销售/);
    expect(md).not.toMatch(/你是销冠|自称销冠/);
  });

  it("本目录没有 Cursor 同事式的额外 agent md", () => {
    const extras = readdirSync(dir).filter(
      (n) => n.endsWith(".md") && n !== "README.md",
    );
    expect(extras.sort()).toEqual(
      NAMES.map((n) => `${n}.md`).sort(),
    );
  });
});
