/** 线索未转化前只有这个状态；转化后阶段在商机上。 */
export const LEAD_STATUSES = ["新线索", "已转化"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** 商机阶段，禁止英文 Discovery/Demo。 */
export const OPP_STAGES = [
  "需求确认",
  "方案报价",
  "谈判",
  "赢单",
  "丢单",
] as const;
export type OppStage = (typeof OPP_STAGES)[number];

export const ACTIVITY_TYPES = ["电话", "企微", "邮件", "拜访"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const AGENTS = [
  "orchestrator",
  "lead-intake",
  "pipeline",
  "followup",
] as const;
export type AgentId = (typeof AGENTS)[number];

/** 时间线展示名：调度不是销售同事 */
export const AGENT_LABEL: Record<AgentId, string> = {
  orchestrator: "系统分配",
  "lead-intake": "建档",
  pipeline: "商机",
  followup: "跟进",
};

export type Role = "sales" | "manager" | "viewer";

export type HandoffStatus =
  | "进行中"
  | "待确认"
  | "已生效"
  | "已拒绝"
  | "已中止";

export type HitlKind = "confirm-convert" | "confirm-send" | "confirm-win-loss";

export type Handoff = {
  id: string;
  leadId: string;
  agent: AgentId;
  status: HandoffStatus;
  summary: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCny: number;
  hitlKind: HitlKind | null;
  proposedStage: OppStage | null;
};

export type Account = { id: string; name: string; leadId: string };
export type Contact = {
  id: string;
  accountId: string;
  name: string;
  title: string;
};
export type Opportunity = {
  id: string;
  accountId: string;
  contactId: string;
  leadId: string;
  name: string;
  stage: OppStage;
};
export type Activity = {
  id: string;
  opportunityId: string;
  type: ActivityType;
  text: string;
  effective: boolean;
};

export type Lead = {
  id: string;
  company: string;
  industry: string;
  status: LeadStatus;
  owner: string;
  contactName: string;
  sourceSummary: string;
  lastActivity: string;
  draftIngest: string;
};

export type DemoState = {
  role: Role;
  seq: number;
  leads: Lead[];
  accounts: Account[];
  contacts: Contact[];
  opportunities: Opportunity[];
  activities: Activity[];
  handoffs: Handoff[];
  pendingArrival: Record<string, AgentId>;
};

export type DemoEvent =
  | { type: "set-role"; role: Role }
  | { type: "start-slice"; leadId: string; text: string }
  | { type: "arrive"; leadId: string }
  | { type: "confirm"; handoffId: string }
  | { type: "reject"; handoffId: string }
  | { type: "abort"; leadId: string }
  | { type: "advance-stage"; leadId: string; stage: OppStage };
