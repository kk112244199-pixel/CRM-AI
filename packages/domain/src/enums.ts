/** 线索未转化前只有这两个状态。禁止英文。 */
export const LEAD_STATUSES = ["新线索", "已转化"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** 商机阶段。禁止 Discovery / Demo。 */
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

export const USER_ROLES = ["sales", "manager", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AGENT_IDS = [
  "orchestrator",
  "lead-intake",
  "pipeline",
  "followup",
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const AGENT_LABEL: Record<AgentId, string> = {
  orchestrator: "系统分配",
  "lead-intake": "建档",
  pipeline: "商机",
  followup: "跟进",
};

export const HANDOFF_STATUSES = [
  "进行中",
  "待确认",
  "已生效",
  "已拒绝",
  "已中止",
  "失败",
] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HITL_KINDS = [
  "confirm-convert",
  "confirm-send",
  "confirm-win-loss",
] as const;
export type HitlKind = (typeof HITL_KINDS)[number];

export const DOCUMENT_KINDS = [
  "email",
  "call-transcript",
  "wecom",
  "handbook",
  "win-or-loss-case",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const COMPANY_NAMES = [
  "杭齿精密机电",
  "嘉兴精工装备",
  "澄海医疗器械",
  "橙果素质教育",
  "邻里鲜超市",
  "夜灯便利",
  "海图进出口",
  "江东水务物资",
] as const;
export type CompanyName = (typeof COMPANY_NAMES)[number];

export const COMPANY_SLUGS = [
  "hangchi",
  "jiaxing",
  "chenghai",
  "chengguo",
  "linli",
  "yedeng",
  "haitu",
  "jiangdong",
] as const;
export type CompanySlug = (typeof COMPANY_SLUGS)[number];
