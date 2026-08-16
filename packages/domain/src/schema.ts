import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  industry: text("industry").notNull(),
  status: text("status").notNull(),
  ownerUserId: text("owner_user_id").references(() => users.id),
  contactName: text("contact_name").notNull(),
  sourceSummary: text("source_summary").notNull(),
  lastActivity: text("last_activity").notNull(),
  /** 档案关键词，S9 写入 sqlite-vec，不再做 SQL 重叠计数。 */
  searchTags: text("search_tags").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  leadId: text("lead_id")
    .notNull()
    .unique()
    .references(() => leads.id),
});

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  name: text("name").notNull(),
  title: text("title").notNull(),
});

export const opportunities = sqliteTable("opportunities", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  leadId: text("lead_id")
    .notNull()
    .unique()
    .references(() => leads.id),
  name: text("name").notNull(),
  stage: text("stage").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  opportunityId: text("opportunity_id")
    .notNull()
    .references(() => opportunities.id),
  type: text("type").notNull(),
  text: text("text").notNull(),
  /** 1 已生效。外发确认前应为 0。M2 闸门。 */
  effective: integer("effective").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  agentId: text("agent_id").notNull(),
  status: text("status").notNull(),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  estimatedCny: real("estimated_cny").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
});

export const handoffs = sqliteTable("handoffs", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => agentRuns.id),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id),
  agentId: text("agent_id").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  hitlKind: text("hitl_kind"),
  proposedStage: text("proposed_stage"),
  /** HITL 草稿 JSON。确认前三张对象不落库。 */
  payload: text("payload"),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  estimatedCny: real("estimated_cny").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const tokenLedger = sqliteTable("token_ledger", {
  id: text("id").primaryKey(),
  runId: text("run_id").references(() => agentRuns.id),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  estimatedCny: real("estimated_cny").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** 语料全文。向量不进本表，进 sqlite-vec 的 vec_leads。 */
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  slug: text("slug").notNull(),
  filename: text("filename").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
});
