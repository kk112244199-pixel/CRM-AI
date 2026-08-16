import type { AgentId } from "./enums";

/**
 * 表级可写白名单。M2 harness 必须按此拒绝越权并写入 audit_events。
 * orchestrator 不是销售同事，禁止写客户三张对象。
 */
export const AGENT_WRITE_TABLES: Record<AgentId, readonly string[]> = {
  orchestrator: ["agent_runs", "handoffs", "leads.owner_user_id"],
  "lead-intake": ["leads"],
  pipeline: ["accounts", "contacts", "opportunities"],
  followup: ["activities"],
};

/** 低风险自动；转化/外发 sales；赢单丢单仅 manager。M2 执行。 */
export const HITL_POLICY = {
  assign: "auto",
  intake: "auto",
  convert: "sales",
  send: "sales",
  midStage: "sales",
  winLoss: "manager",
} as const;

export function agentMayWrite(agent: AgentId, table: string): boolean {
  return AGENT_WRITE_TABLES[agent].some(
    (allowed) => allowed === table || allowed.startsWith(`${table}.`),
  );
}
