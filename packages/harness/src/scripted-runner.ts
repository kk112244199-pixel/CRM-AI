import type { AgentId } from "@hengce/domain";
import { SCRIPTED_TOKENS } from "./token";
import type { AgentRunner } from "./runner";

export type ScriptedMap = Partial<Record<AgentId, string>>;

/** 无密钥单测用。禁止冒充黄金切片已跑真模型。 */
export function scriptedRunner(overrides: ScriptedMap = {}): AgentRunner {
  const defaults: Record<AgentId, string> = {
    orchestrator: JSON.stringify({
      summary: "系统分配给销售-陈。禁止本步写客户/联系人/商机。",
      ownerUserId: "user-sales-chen",
    }),
    "lead-intake": JSON.stringify({
      summary: "建档完成：橙果素质教育，联系人 林校长。未转化，无商机。",
      leadFields: {
        company: "橙果素质教育",
        industry: "区域教培连锁",
        contactName: "林校长",
        sourceSummary: "林校长想给三个校区上销售跟进台账",
        searchTags: "教培,校区,连锁",
      },
    }),
    pipeline: JSON.stringify({
      summary:
        "转化建议：客户「橙果素质教育」+ 联系人「林校长」+ 商机「衡策销管」进入需求确认。",
      action: "propose_convert",
      proposal: {
        accountName: "橙果素质教育",
        contactName: "林校长",
        contactTitle: "校长",
        opportunityName: "橙果素质教育 / 衡策销管",
        stage: "需求确认",
      },
    }),
    followup: JSON.stringify({
      summary: "跟进草稿，类型：电话。确认发出前不算活动。",
      action: "draft_activity",
      activity: {
        type: "电话",
        text: "电话邀约 林校长 做产品演示",
      },
    }),
  };

  return {
    async run({ agentId }) {
      const text = overrides[agentId as AgentId] ?? defaults[agentId as AgentId];
      if (!text) {
        return { text: "missing", promptTokens: 1, completionTokens: 1, ok: false };
      }
      const tok = SCRIPTED_TOKENS[agentId] ?? { prompt: 10, completion: 10 };
      return {
        text,
        promptTokens: tok.prompt,
        completionTokens: tok.completion,
        ok: true,
      };
    },
  };
}
