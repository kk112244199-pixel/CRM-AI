export { AGENT_WRITE_TABLES, HITL_POLICY, agentMayWrite } from "./acl";
export { bootstrapFileDb, bootstrapMemoryDb, createMemoryDb } from "./bootstrap";
export { CORPUS } from "./corpus";
export { closeDb, openDb, type AppDb, type SqliteHandle } from "./db";
export {
  ACTIVITY_TYPES,
  AGENT_IDS,
  AGENT_LABEL,
  COMPANY_NAMES,
  COMPANY_SLUGS,
  DOCUMENT_KINDS,
  HITL_KINDS,
  LEAD_STATUSES,
  OPP_STAGES,
  USER_ROLES,
  type ActivityType,
  type AgentId,
  type CompanyName,
  type DocumentKind,
  type HitlKind,
  type LeadStatus,
  type OppStage,
  type UserRole,
} from "./enums";
export { migrate } from "./migrate";
export { corpusDir, dbFilePath, repoRoot } from "./paths";
export {
  accounts,
  activities,
  agentRuns,
  auditEvents,
  contacts,
  documents,
  handoffs,
  leads,
  opportunities,
  tokenLedger,
  users,
} from "./schema";
export { seed } from "./seed";
export { embedLeadText, rebuildLeadVec, VEC_DIM } from "./vec";
export { writeCorpusFiles } from "./write-corpus";
