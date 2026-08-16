import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, type AgentId } from "@hengce/domain";

const SKILLS: Record<AgentId, string[]> = {
  orchestrator: ["crm-domain"],
  "lead-intake": ["crm-domain"],
  pipeline: ["crm-domain", "lead-pipeline"],
  followup: ["followup-activity"],
};

export const JSON_SHAPE: Record<AgentId, string> = {
  orchestrator:
    '只输出一个 JSON：{"summary":"中文","ownerUserId":"user-sales-chen"}。禁止 proposal、writes、stage。',
  "lead-intake":
    '只输出一个 JSON：{"summary":"中文","leadFields":{"company":"...","industry":"...","contactName":"...","sourceSummary":"...","searchTags":"..."}}。status 保持新线索。禁止 stage。',
  pipeline:
    '只输出一个 JSON：{"summary":"中文","action":"propose_convert","proposal":{"accountName":"...","contactName":"...","contactTitle":"...","opportunityName":"...","stage":"需求确认"}}。禁止 Discovery/Demo。禁止 activities。',
  followup:
    '只输出一个 JSON：{"summary":"中文","action":"draft_activity","activity":{"type":"电话","text":"..."}}。type 仅电话/企微/邮件/拜访。禁止 stage。',
};

export function readAgentPrompt(agentId: AgentId): string {
  const root = repoRoot();
  const def = readFileSync(join(root, "runtime", "agents", `${agentId}.md`), "utf8");
  const skillParts = SKILLS[agentId].map((name) =>
    readFileSync(join(root, "runtime", "skills", name, "SKILL.md"), "utf8"),
  );
  return `${def}\n\n${skillParts.join("\n\n")}`;
}

/** 真模型共用：人设 + 禁区 + 结构化形状。调度器传入的是本条线索快照。 */
export function buildAgentMessages(
  agentId: AgentId,
  userPrompt: string,
): { system: string; user: string } {
  return {
    system: [
      readAgentPrompt(agentId),
      "",
      "不要修改仓库文件。不要调用 cloud。不要与其它 Agent 直连。",
      JSON_SHAPE[agentId],
    ].join("\n"),
    user: userPrompt,
  };
}
