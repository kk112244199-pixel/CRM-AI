export type Role = "sales" | "manager" | "viewer";

export type AgentId = "orchestrator" | "lead-intake" | "pipeline" | "followup";

export const AGENT_LABEL: Record<AgentId, string> = {
  orchestrator: "系统分配",
  "lead-intake": "建档",
  pipeline: "商机",
  followup: "跟进",
};

export const HITL_LABEL: Record<string, string> = {
  "confirm-convert": "确认转化",
  "confirm-send": "确认发出",
  "confirm-win-loss": "主管确认赢单/丢单",
};

export const USER_LABEL: Record<string, string> = {
  "user-sales-chen": "销售-陈",
  "user-sales-liu": "销售-刘",
  "user-manager-zhou": "经理-周",
  "user-viewer-wu": "只读-吴",
};

export type OppStage = "需求确认" | "方案报价" | "谈判" | "赢单" | "丢单";

export type Lead = {
  id: string;
  company: string;
  industry: string;
  status: string;
  ownerUserId: string | null;
  contactName: string;
  sourceSummary: string;
  lastActivity: string;
  oppStage?: string | null;
};

export type Handoff = {
  id: string;
  runId: string | null;
  leadId: string;
  agentId: AgentId;
  status: string;
  summary: string;
  hitlKind: string | null;
  proposedStage: string | null;
  promptTokens: number;
  completionTokens: number;
  estimatedCny: number;
};

export type LeadCard = {
  lead: Lead;
  account: { id: string; name: string; leadId: string } | null;
  contact: { id: string; name: string; title: string } | null;
  opportunity: {
    id: string;
    name: string;
    stage: string;
    leadId: string;
  } | null;
  activities: {
    id: string;
    type: string;
    text: string;
    effective: number;
  }[];
  timeline: Handoff[];
};

export type Usage = {
  total: number;
  estimatedCny: number;
  runSum: number;
  ledgerSum: number;
  runs: {
    id: string;
    leadId: string;
    agentId: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCny: number;
  }[];
};

export type PendingItem = {
  id: string;
  leadId: string;
  agentId: AgentId;
  status: string;
  summary: string;
  hitlKind: string | null;
  company: string;
};

export type ImportLeadsResult = {
  ok: boolean;
  imported: { id: string; company: string }[];
  skipped: { company: string; reason: string }[];
  errors: { line: number; message: string }[];
};
