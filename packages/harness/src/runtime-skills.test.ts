import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "@hengce/domain";

const SKILLS = ["crm-domain", "lead-pipeline", "followup-activity"] as const;

describe("runtime/skills S5", () => {
  const dir = join(repoRoot(), "runtime", "skills");

  it("三份 skill 在 runtime/skills，不在 .cursor/skills", () => {
    for (const name of SKILLS) {
      expect(existsSync(join(dir, name, "SKILL.md"))).toBe(true);
      expect(
        existsSync(join(repoRoot(), ".cursor", "skills", name, "SKILL.md")),
      ).toBe(false);
    }
  });

  it("description 第三人称含 When to use；SKILL.md 精简且有 references", () => {
    for (const name of SKILLS) {
      const md = readFileSync(join(dir, name, "SKILL.md"), "utf8");
      const desc = md.match(/^description:\s*(.+)$/m)?.[1] ?? "";
      expect(desc).toMatch(/This skill should be used when/i);
      expect(desc).toMatch(/When to use/i);
      expect(desc).not.toMatch(/^(I can|You can)/i);
      expect(md.split(/\r?\n/).length).toBeLessThan(80);
      expect(md).toMatch(/references\//);
      expect(md).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("枚举为中文阶段，禁止 Discovery/Demo", () => {
    const domain = readFileSync(join(dir, "crm-domain", "SKILL.md"), "utf8");
    expect(domain).toMatch(/新线索/);
    expect(domain).toMatch(/已转化/);
    expect(domain).toMatch(/需求确认/);
    expect(domain).toMatch(/方案报价/);
    expect(domain).toMatch(/谈判/);
    expect(domain).toMatch(/赢单/);
    expect(domain).toMatch(/丢单/);
    expect(domain).toMatch(/禁止/);
    expect(domain).toMatch(/Discovery/);
    const pipeline = readFileSync(
      join(dir, "lead-pipeline", "SKILL.md"),
      "utf8",
    );
    expect(pipeline).not.toMatch(/stage:\s*Discovery/i);
    const follow = readFileSync(
      join(dir, "followup-activity", "SKILL.md"),
      "utf8",
    );
    expect(follow).toMatch(/电话/);
    expect(follow).toMatch(/企微/);
    expect(follow).toMatch(/邮件/);
    expect(follow).toMatch(/拜访/);
  });

  it("各 skill 有 references 且未把 PRD 全文拷入", () => {
    expect(
      existsSync(join(dir, "crm-domain", "references", "fields.md")),
    ).toBe(true);
    expect(
      existsSync(join(dir, "lead-pipeline", "references", "gates.md")),
    ).toBe(true);
    expect(
      existsSync(
        join(dir, "followup-activity", "references", "activity-types.md"),
      ),
    ).toBe(true);
    const blob = SKILLS.map((n) =>
      readFileSync(join(dir, n, "SKILL.md"), "utf8"),
    ).join("\n");
    expect(blob).not.toMatch(/## 1\. 一句话/);
    expect(blob).not.toMatch(/create-plan/);
    const extras = readdirSync(dir).filter(
      (n) => n !== "README.md" && !n.startsWith("."),
    );
    expect(extras.sort()).toEqual([...SKILLS].sort());
  });
});
