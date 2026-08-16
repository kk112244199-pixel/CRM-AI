export type ConvertProposal = {
  accountName: string;
  contactName: string;
  contactTitle: string;
  opportunityName: string;
  stage: string;
};

export type AgentJson = {
  summary: string;
  ownerUserId?: string;
  leadFields?: {
    company?: string;
    industry?: string;
    contactName?: string;
    sourceSummary?: string;
    searchTags?: string;
    status?: string;
  };
  action?: "propose_convert" | "advance_stage" | "draft_activity";
  proposal?: ConvertProposal;
  stage?: string;
  activity?: { type: string; text: string };
  /** 测试注入越权时使用。正常 Agent 不应输出。 */
  writes?: { table: string }[];
};

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("no-json");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

export function parseAgentJson(text: string): AgentJson {
  const raw = extractJson(text);
  if (!raw || typeof raw !== "object") throw new Error("not-object");
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== "string" || !o.summary.trim()) {
    throw new Error("missing-summary");
  }
  return o as AgentJson;
}
