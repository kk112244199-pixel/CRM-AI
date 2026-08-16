import { asc, eq } from "drizzle-orm";
import {
  ACTIVITY_TYPES,
  LEAD_STATUSES,
  OPP_STAGES,
  accounts,
  activities,
  agentMayWrite,
  agentRuns,
  auditEvents,
  contacts,
  handoffs,
  leads,
  opportunities,
  rebuildLeadVec,
  tokenLedger,
  type AgentId,
  type AppDb,
  type HitlKind,
  type LeadStatus,
  type OppStage,
  type SqliteHandle,
  type UserRole,
} from "@hengce/domain";
import { HarnessError } from "./errors";
import { newId } from "./ids";
import { parseAgentJson, type AgentJson, type ConvertProposal } from "./parse-output";
import type { AgentRunner } from "./runner";
import { estimateCny } from "./token";

export type HarnessCtx = {
  db: AppDb;
  sqlite: SqliteHandle;
  runner: AgentRunner;
};

function now(): number {
  return Date.now();
}

function canMutate(role: UserRole): boolean {
  return role !== "viewer";
}

function canConfirm(role: UserRole, kind: HitlKind | null): boolean {
  if (role === "viewer" || !kind) return false;
  if (kind === "confirm-win-loss") return role === "manager";
  return role === "sales" || role === "manager";
}

function sliceBusy(sqlite: SqliteHandle, leadId: string): boolean {
  const row = sqlite
    .prepare(
      `SELECT COUNT(*) AS n FROM handoffs
       WHERE lead_id = ? AND status IN ('待确认', '进行中')`,
    )
    .get(leadId) as { n: number };
  return row.n > 0;
}

function audit(
  db: AppDb,
  actor: string,
  action: string,
  detail: string,
): void {
  db.insert(auditEvents)
    .values({
      id: newId("aud"),
      actor,
      action,
      detail,
      createdAt: now(),
    })
    .run();
}

/** R2：每次 run 同时写入 agent_runs 与 token_ledger，禁止只记一边。 */
function persistRun(
  db: AppDb,
  input: {
    runId: string;
    leadId: string;
    agentId: AgentId;
    status: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCny: number;
  },
): void {
  const t = now();
  db.insert(agentRuns)
    .values({
      id: input.runId,
      leadId: input.leadId,
      agentId: input.agentId,
      status: input.status,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      estimatedCny: input.estimatedCny,
      startedAt: t,
      endedAt: t,
    })
    .run();
  db.insert(tokenLedger)
    .values({
      id: newId("tok"),
      runId: input.runId,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      estimatedCny: input.estimatedCny,
      createdAt: t,
    })
    .run();
}

function insertHandoff(
  db: AppDb,
  row: {
    runId: string;
    leadId: string;
    agentId: AgentId;
    status: string;
    summary: string;
    hitlKind?: string | null;
    proposedStage?: string | null;
    payload?: string | null;
    promptTokens: number;
    completionTokens: number;
    estimatedCny: number;
  },
): string {
  const id = newId("h");
  db.insert(handoffs)
    .values({
      id,
      runId: row.runId,
      leadId: row.leadId,
      agentId: row.agentId,
      status: row.status,
      summary: row.summary,
      hitlKind: row.hitlKind ?? null,
      proposedStage: row.proposedStage ?? null,
      payload: row.payload ?? null,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      estimatedCny: row.estimatedCny,
      createdAt: now(),
    })
    .run();
  return id;
}

/** R4：按表级白名单拦截越权；拒绝后不得应用业务写入。 */
function illegalWrites(agentId: AgentId, json: AgentJson): string[] {
  const hits: string[] = [];
  for (const w of json.writes ?? []) {
    if (!agentMayWrite(agentId, w.table)) hits.push(w.table);
  }
  if (agentId === "lead-intake") {
    if (json.leadFields?.status === "已转化") hits.push("leads.status");
    // 建档不得写商机阶段，也不得借转化建议越权
    if (json.stage || json.proposal || json.action === "propose_convert") {
      hits.push("opportunities.stage");
    }
  }
  if (agentId === "followup" && json.stage) hits.push("opportunities");
  if (
    agentId === "orchestrator" &&
    (json.action === "propose_convert" || json.proposal)
  ) {
    hits.push("accounts");
  }
  return hits;
}

function leadRow(db: AppDb, leadId: string) {
  return db.select().from(leads).where(eq(leads.id, leadId)).get();
}

/** 真模型常把 searchTags 建成数组；undefined 进 drizzle set 会绑多参数。 */
function asText(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item).trim()).filter(Boolean).join(",");
    if (joined) return joined;
  }
  return fallback;
}

async function dispatch(
  ctx: HarnessCtx,
  leadId: string,
  agentId: AgentId,
  userPrompt: string,
): Promise<{ failed: boolean; handoffId?: string }> {
  const runId = newId("run");
  const result = await ctx.runner.run({ agentId, prompt: userPrompt });
  const cny = estimateCny(result.promptTokens, result.completionTokens);
  const tok = {
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedCny: cny,
  };

  if (!result.ok) {
    persistRun(ctx.db, {
      runId,
      leadId,
      agentId,
      status: "失败",
      ...tok,
    });
    insertHandoff(ctx.db, {
      runId,
      leadId,
      agentId,
      status: "失败",
      summary: "Agent 运行失败，后续不再改库。",
      ...tok,
    });
    return { failed: true };
  }

  let json: AgentJson;
  try {
    json = parseAgentJson(result.text);
  } catch {
    // Q3：非法 JSON 不得入库业务对象
    persistRun(ctx.db, { runId, leadId, agentId, status: "失败", ...tok });
    insertHandoff(ctx.db, {
      runId,
      leadId,
      agentId,
      status: "失败",
      summary: "输出不是合法 JSON，未写入业务表。",
      ...tok,
    });
    return { failed: true };
  }

  const bad = illegalWrites(agentId, json);
  if (bad.length > 0) {
    // R4：越权拒绝并记审计，后续 Agent 不继续
    persistRun(ctx.db, { runId, leadId, agentId, status: "失败", ...tok });
    audit(
      ctx.db,
      agentId,
      "acl-deny",
      `禁止写 ${bad.join(",")}；未应用业务写入`,
    );
    insertHandoff(ctx.db, {
      runId,
      leadId,
      agentId,
      status: "失败",
      summary: `越权写入已拒绝：${bad.join(", ")}`,
      ...tok,
    });
    return { failed: true };
  }

  persistRun(ctx.db, { runId, leadId, agentId, status: "已结束", ...tok });
  return applyJson(ctx, { runId, leadId, agentId, json, ...tok });
}

function applyJson(
  ctx: HarnessCtx,
  input: {
    runId: string;
    leadId: string;
    agentId: AgentId;
    json: AgentJson;
    promptTokens: number;
    completionTokens: number;
    estimatedCny: number;
  },
): { failed: boolean; handoffId?: string } {
  const { json, agentId, leadId } = input;
  const db = ctx.db;
  const tok = {
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    estimatedCny: input.estimatedCny,
  };

  if (agentId === "orchestrator") {
    if (!json.ownerUserId) {
      insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "失败",
        summary: "缺少 ownerUserId",
        ...tok,
      });
      return { failed: true };
    }
    db.update(leads)
      .set({
        ownerUserId: json.ownerUserId,
        lastActivity: "已分配，等待建档",
      })
      .where(eq(leads.id, leadId))
      .run();
    const handoffId = insertHandoff(db, {
      runId: input.runId,
      leadId,
      agentId,
      status: "已生效",
      summary: json.summary,
      ...tok,
    });
    return { failed: false, handoffId };
  }

  if (agentId === "lead-intake") {
    const row = leadRow(db, leadId);
    if (!row) {
      insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "失败",
        summary: "线索不存在，建档未写入",
        ...tok,
      });
      return { failed: true };
    }
    const f = json.leadFields ?? {};
    db.update(leads)
      .set({
        company: asText(f.company, row.company),
        industry: asText(f.industry, row.industry),
        contactName: asText(f.contactName, row.contactName),
        sourceSummary: asText(f.sourceSummary, row.sourceSummary),
        searchTags: asText(f.searchTags, row.searchTags),
        lastActivity: "建档已自动生效",
      })
      .where(eq(leads.id, leadId))
      .run();
    const handoffId = insertHandoff(db, {
      runId: input.runId,
      leadId,
      agentId,
      status: "已生效",
      summary: json.summary,
      ...tok,
    });
    return { failed: false, handoffId };
  }

  if (agentId === "pipeline" && json.action === "propose_convert") {
    const proposal = json.proposal;
    if (!proposal || proposal.stage === "Discovery" || /Demo/i.test(proposal.stage)) {
      insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "失败",
        summary: "转化建议缺少合法中文阶段",
        ...tok,
      });
      return { failed: true };
    }
    const handoffId = insertHandoff(db, {
      runId: input.runId,
      leadId,
      agentId,
      status: "待确认",
      summary: json.summary,
      hitlKind: "confirm-convert",
      payload: JSON.stringify(proposal),
      ...tok,
    });
    db.update(leads)
      .set({ lastActivity: "转化待确认" })
      .where(eq(leads.id, leadId))
      .run();
    return { failed: false, handoffId };
  }

  if (agentId === "pipeline" && json.action === "advance_stage" && json.stage) {
    if (!OPP_STAGES.includes(json.stage as OppStage)) {
      insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "失败",
        summary: "非法阶段名",
        ...tok,
      });
      return { failed: true };
    }
    const high = json.stage === "赢单" || json.stage === "丢单";
    if (high) {
      const handoffId = insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "待确认",
        summary: json.summary,
        hitlKind: "confirm-win-loss",
        proposedStage: json.stage,
        ...tok,
      });
      return { failed: false, handoffId };
    }
    db.update(opportunities)
      .set({ stage: json.stage as OppStage })
      .where(eq(opportunities.leadId, leadId))
      .run();
    const handoffId = insertHandoff(db, {
      runId: input.runId,
      leadId,
      agentId,
      status: "已生效",
      summary: json.summary,
      ...tok,
    });
    return { failed: false, handoffId };
  }

  if (agentId === "followup") {
    const act = json.activity;
    if (!act || !ACTIVITY_TYPES.includes(act.type as (typeof ACTIVITY_TYPES)[number])) {
      insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "失败",
        summary: "活动缺少合法 type",
        ...tok,
      });
      return { failed: true };
    }
    const opp = db
      .select()
      .from(opportunities)
      .where(eq(opportunities.leadId, leadId))
      .get();
    if (!opp) {
      insertHandoff(db, {
        runId: input.runId,
        leadId,
        agentId,
        status: "失败",
        summary: "未转化，不能写活动",
        ...tok,
      });
      return { failed: true };
    }
    db.insert(activities)
      .values({
        id: newId("act"),
        opportunityId: opp.id,
        type: act.type as (typeof ACTIVITY_TYPES)[number],
        text: act.text,
        effective: 0,
        createdAt: now(),
      })
      .run();
    const handoffId = insertHandoff(db, {
      runId: input.runId,
      leadId,
      agentId,
      status: "待确认",
      summary: json.summary,
      hitlKind: "confirm-send",
      payload: JSON.stringify({ activityType: act.type }),
      ...tok,
    });
    db.update(leads)
      .set({ lastActivity: "跟进待确认发出" })
      .where(eq(leads.id, leadId))
      .run();
    return { failed: false, handoffId };
  }

  insertHandoff(db, {
    runId: input.runId,
    leadId,
    agentId,
    status: "失败",
    summary: "无法识别的 Agent 输出",
    ...tok,
  });
  return { failed: true };
}

function applyConvert(db: AppDb, leadId: string, proposal: ConvertProposal): void {
  const lead = leadRow(db, leadId);
  if (!lead || lead.status === "已转化") return;
  const accId = newId("acc");
  const ctId = newId("ct");
  const oppId = newId("opp");
  db.insert(accounts)
    .values({ id: accId, name: proposal.accountName, leadId })
    .run();
  db.insert(contacts)
    .values({
      id: ctId,
      accountId: accId,
      name: proposal.contactName,
      title: proposal.contactTitle,
    })
    .run();
  db.insert(opportunities)
    .values({
      id: oppId,
      accountId: accId,
      contactId: ctId,
      leadId,
      name: proposal.opportunityName,
      stage: "需求确认",
    })
    .run();
  db.update(leads)
    .set({ status: "已转化", lastActivity: "已转化为客户+联系人+商机" })
    .where(eq(leads.id, leadId))
    .run();
}

function hasEffective(
  db: AppDb,
  leadId: string,
  agentId: AgentId,
): boolean {
  return leadTimeline(db, leadId).some(
    (h) => h.agentId === agentId && h.status === "已生效",
  );
}

/** 顺序：系统分配 → 建档 → 商机转化建议。禁止四 Agent 并行。 */
export async function ingestLead(
  ctx: HarnessCtx,
  input: { leadId: string; text: string; role: UserRole },
): Promise<{ leadId: string }> {
  if (!canMutate(input.role)) {
    throw new HarnessError(403, "viewer 只读");
  }
  const lead = leadRow(ctx.db, input.leadId);
  if (!lead) throw new HarnessError(404, "线索不存在");
  if (lead.status === "已转化") {
    throw new HarnessError(409, "已转化线索请走阶段推进，不要重新 ingest");
  }
  if (sliceBusy(ctx.sqlite, input.leadId)) {
    throw new HarnessError(409, "本条线索仍有待确认或进行中的交卷");
  }

  const snapshot = JSON.stringify({
    lead,
    ingestText: input.text,
  });

  // 同一线索必须 await 顺序交卷；禁止 Promise.all 让四个 Agent 同时开工
  // R1：已生效步骤跳过，崩溃后续跑不得丢掉已落库 handoff，也不得复用同一 run_id
  if (!hasEffective(ctx.db, input.leadId, "orchestrator")) {
    const a1 = await dispatch(
      ctx,
      input.leadId,
      "orchestrator",
      `新线索刚录入，请指定所有人。当前：${snapshot}`,
    );
    if (a1.failed) return { leadId: input.leadId };
  }

  if (!hasEffective(ctx.db, input.leadId, "lead-intake")) {
    const a2 = await dispatch(
      ctx,
      input.leadId,
      "lead-intake",
      `系统分配已生效，请补全线索字段，保持新线索。录入：${input.text}`,
    );
    if (a2.failed) return { leadId: input.leadId };
  }

  if (!hasEffective(ctx.db, input.leadId, "pipeline")) {
    await dispatch(
      ctx,
      input.leadId,
      "pipeline",
      `建档已生效，请给出转化建议（客户+联系人+商机=需求确认），不要写 activities。`,
    );
  }
  return { leadId: input.leadId };
}

export async function confirmHandoff(
  ctx: HarnessCtx,
  input: { handoffId: string; role: UserRole },
): Promise<void> {
  const h = ctx.db
    .select()
    .from(handoffs)
    .where(eq(handoffs.id, input.handoffId))
    .get();
  if (!h || h.status !== "待确认") {
    throw new HarnessError(404, "没有待确认交卷");
  }
  if (!canConfirm(input.role, h.hitlKind as HitlKind | null)) {
    throw new HarnessError(403, "当前角色不能确认此项");
  }

  const markDone = () => {
    ctx.db
      .update(handoffs)
      .set({ status: "已生效" })
      .where(eq(handoffs.id, h.id))
      .run();
  };

  if (h.hitlKind === "confirm-convert") {
    let proposal: ConvertProposal;
    try {
      proposal = JSON.parse(h.payload ?? "") as ConvertProposal;
    } catch {
      throw new HarnessError(400, "转化草稿不是合法 JSON");
    }
    if (!proposal.accountName || !proposal.contactName || !proposal.opportunityName) {
      throw new HarnessError(400, "转化草稿不完整");
    }
    applyConvert(ctx.db, h.leadId, proposal);
    markDone();
    // 确认转化后才拉起跟进；禁止与商机并行开工
    await dispatch(
      ctx,
      h.leadId,
      "followup",
      `转化已生效，请起草电话跟进活动，effective 保持未发出。`,
    );
    return;
  }

  if (h.hitlKind === "confirm-send") {
    const opp = ctx.db
      .select()
      .from(opportunities)
      .where(eq(opportunities.leadId, h.leadId))
      .get();
    if (opp) {
      ctx.sqlite
        .prepare(
          `UPDATE activities SET effective = 1
           WHERE opportunity_id = ? AND effective = 0`,
        )
        .run(opp.id);
    }
    ctx.db
      .update(leads)
      .set({ lastActivity: "跟进活动已生效" })
      .where(eq(leads.id, h.leadId))
      .run();
    markDone();
    return;
  }

  if (h.hitlKind === "confirm-win-loss" && h.proposedStage) {
    ctx.db
      .update(opportunities)
      .set({ stage: h.proposedStage as OppStage })
      .where(eq(opportunities.leadId, h.leadId))
      .run();
    ctx.db
      .update(leads)
      .set({ lastActivity: `商机已${h.proposedStage}` })
      .where(eq(leads.id, h.leadId))
      .run();
    markDone();
  }
}

export function rejectHandoff(
  ctx: HarnessCtx,
  input: { handoffId: string; role: UserRole },
): void {
  const h = ctx.db
    .select()
    .from(handoffs)
    .where(eq(handoffs.id, input.handoffId))
    .get();
  if (!h || h.status !== "待确认") {
    throw new HarnessError(404, "没有待确认交卷");
  }
  if (!canConfirm(input.role, h.hitlKind as HitlKind | null)) {
    throw new HarnessError(403, "当前角色不能拒绝此项");
  }
  ctx.db
    .update(handoffs)
    .set({ status: "已拒绝" })
    .where(eq(handoffs.id, h.id))
    .run();
  ctx.db
    .update(leads)
    .set({ lastActivity: "已拒绝，后续不再追加" })
    .where(eq(leads.id, h.leadId))
    .run();
}

export function abortRun(
  ctx: HarnessCtx,
  input: { runId: string; role: UserRole },
): void {
  if (!canMutate(input.role)) throw new HarnessError(403, "viewer 只读");
  const run = ctx.db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, input.runId))
    .get();
  if (!run) throw new HarnessError(404, "run 不存在");
  // 中止只清排队（待确认/进行中），已生效与失败行保留
  ctx.sqlite
    .prepare(
      `UPDATE handoffs SET status = '已中止'
       WHERE lead_id = ? AND status IN ('待确认', '进行中')`,
    )
    .run(run.leadId);
  ctx.db
    .update(leads)
    .set({ lastActivity: "已中止后续，历史 handoff 保留" })
    .where(eq(leads.id, run.leadId))
    .run();
}

/** 控制台按线索中止：清排队，保留已生效/失败历史。 */
export function abortLead(
  ctx: HarnessCtx,
  input: { leadId: string; role: UserRole },
): void {
  if (!canMutate(input.role)) throw new HarnessError(403, "viewer 只读");
  const lead = leadRow(ctx.db, input.leadId);
  if (!lead) throw new HarnessError(404, "线索不存在");
  const run = ctx.sqlite
    .prepare(
      `SELECT id FROM agent_runs WHERE lead_id = ? ORDER BY started_at DESC LIMIT 1`,
    )
    .get(input.leadId) as { id: string } | undefined;
  if (run) {
    abortRun(ctx, { runId: run.id, role: input.role });
    return;
  }
  ctx.sqlite
    .prepare(
      `UPDATE handoffs SET status = '已中止'
       WHERE lead_id = ? AND status IN ('待确认', '进行中')`,
    )
    .run(input.leadId);
  ctx.db
    .update(leads)
    .set({ lastActivity: "已中止后续，历史 handoff 保留" })
    .where(eq(leads.id, input.leadId))
    .run();
}

export function listPending(sqlite: SqliteHandle): {
  id: string;
  leadId: string;
  agentId: string;
  status: string;
  summary: string;
  hitlKind: string | null;
  company: string;
}[] {
  return sqlite
    .prepare(
      `SELECT h.id, h.lead_id AS leadId, h.agent_id AS agentId, h.status,
              h.summary, h.hitl_kind AS hitlKind, l.company
       FROM handoffs h
       JOIN leads l ON l.id = h.lead_id
       WHERE h.status = '待确认'
       ORDER BY h.created_at`,
    )
    .all() as {
    id: string;
    leadId: string;
    agentId: string;
    status: string;
    summary: string;
    hitlKind: string | null;
    company: string;
  }[];
}

export function advanceStage(
  ctx: HarnessCtx,
  input: { leadId: string; stage: OppStage; role: UserRole },
): void {
  if (!canMutate(input.role)) throw new HarnessError(403, "viewer 只读");
  const opp = ctx.db
    .select()
    .from(opportunities)
    .where(eq(opportunities.leadId, input.leadId))
    .get();
  if (!opp) throw new HarnessError(409, "未转化无商机");
  if (sliceBusy(ctx.sqlite, input.leadId)) {
    throw new HarnessError(409, "仍有待确认交卷");
  }
  const high = input.stage === "赢单" || input.stage === "丢单";
  if (high) {
    const runId = newId("run");
    persistRun(ctx.db, {
      runId,
      leadId: input.leadId,
      agentId: "pipeline",
      status: "已结束",
      promptTokens: 0,
      completionTokens: 0,
      estimatedCny: 0,
    });
    insertHandoff(ctx.db, {
      runId,
      leadId: input.leadId,
      agentId: "pipeline",
      status: "待确认",
      summary: `高风险：建议商机改为「${input.stage}」。须主管确认。`,
      hitlKind: "confirm-win-loss",
      proposedStage: input.stage,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCny: 0,
    });
    ctx.db
      .update(leads)
      .set({ lastActivity: "赢单/丢单待主管确认" })
      .where(eq(leads.id, input.leadId))
      .run();
    return;
  }
  ctx.db
    .update(opportunities)
    .set({ stage: input.stage })
    .where(eq(opportunities.leadId, input.leadId))
    .run();
  ctx.db
    .update(leads)
    .set({ lastActivity: `销售推进阶段至${input.stage}` })
    .where(eq(leads.id, input.leadId))
    .run();
}

export function usageTotals(sqlite: SqliteHandle): {
  total: number;
  cny: number;
} {
  const row = sqlite
    .prepare(
      `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS total,
              COALESCE(SUM(estimated_cny), 0) AS cny
       FROM token_ledger`,
    )
    .get() as { total: number; cny: number };
  return { total: Number(row.total), cny: Number(row.cny) };
}

export function listLeads(db: AppDb) {
  return db.select().from(leads).all();
}

export type LeadListFilters = {
  status?: LeadStatus;
  stage?: OppStage;
};

export function listLeadRows(db: AppDb, filters?: LeadListFilters) {
  const all = listLeads(db);
  const opps = db.select().from(opportunities).all();
  let rows = all.map((l) => ({
    ...l,
    oppStage: opps.find((o) => o.leadId === l.id)?.stage ?? null,
  }));
  if (filters?.status) {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters?.stage) {
    rows = rows.filter((r) => r.oppStage === filters.stage);
  }
  return rows;
}

export type CsvImportResult = {
  ok: true;
  imported: { id: string; company: string }[];
  skipped: { company: string; reason: string }[];
  errors: { line: number; message: string }[];
};

const CSV_REQUIRED = [
  "company",
  "industry",
  "contactName",
  "sourceSummary",
] as const;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function csvLeadId(db: AppDb, seq: number, company: string): string {
  const slug =
    company.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "").slice(0, 16) || "row";
  let id = `lead-csv-${slug}-${seq}`;
  let n = seq;
  while (db.select({ id: leads.id }).from(leads).where(eq(leads.id, id)).get()) {
    n++;
    id = `lead-csv-${slug}-${n}`;
  }
  return id;
}

/** CSV 批量导入新线索；不触发 ingest 或 Agent。 */
export function importLeadsFromCsv(
  ctx: HarnessCtx,
  input: { csv: string; role: UserRole },
): CsvImportResult {
  if (!canMutate(input.role)) {
    throw new HarnessError(403, "viewer 只读");
  }

  const imported: { id: string; company: string }[] = [];
  const skipped: { company: string; reason: string }[] = [];
  const errors: { line: number; message: string }[] = [];

  const raw = input.csv.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    errors.push({ line: 1, message: "CSV 为空" });
    return { ok: true, imported, skipped, errors };
  }

  const header = parseCsvLine(lines[0]!);
  const colIndex = new Map<string, number>();
  header.forEach((name, i) => colIndex.set(name.trim(), i));

  for (const col of CSV_REQUIRED) {
    if (!colIndex.has(col)) {
      errors.push({ line: 1, message: `缺少表头列 ${col}` });
      return { ok: true, imported, skipped, errors };
    }
  }

  const existing = new Set(
    ctx.db.select({ company: leads.company }).from(leads).all().map((r) => r.company),
  );
  let seq = 0;

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i]!;
    if (line.trim() === "") continue;

    const fields = parseCsvLine(line);
    const get = (col: string) => {
      const idx = colIndex.get(col);
      return idx === undefined ? "" : (fields[idx] ?? "").trim();
    };

    const company = get("company");
    if (!company) {
      errors.push({ line: lineNum, message: "缺少 company" });
      continue;
    }
    if (existing.has(company)) {
      skipped.push({ company, reason: "公司已存在" });
      continue;
    }

    const industry = get("industry");
    const contactName = get("contactName");
    const sourceSummary = get("sourceSummary");
    if (!industry || !contactName || !sourceSummary) {
      errors.push({ line: lineNum, message: "缺少必填列" });
      continue;
    }

    seq++;
    const id = csvLeadId(ctx.db, seq, company);
    ctx.db
      .insert(leads)
      .values({
        id,
        company,
        industry,
        status: LEAD_STATUSES[0],
        ownerUserId: null,
        contactName,
        sourceSummary,
        lastActivity: "CSV 导入",
        searchTags: get("searchTags"),
        createdAt: now(),
      })
      .run();
    existing.add(company);
    imported.push({ id, company });
  }

  if (imported.length > 0) {
    rebuildLeadVec(ctx.sqlite);
  }

  return { ok: true, imported, skipped, errors };
}

export function leadTimeline(db: AppDb, leadId: string) {
  return db
    .select()
    .from(handoffs)
    .where(eq(handoffs.leadId, leadId))
    .orderBy(asc(handoffs.createdAt))
    .all();
}

export function getLeadCard(db: AppDb, leadId: string) {
  const lead = leadRow(db, leadId);
  if (!lead) return null;
  const account =
    db.select().from(accounts).where(eq(accounts.leadId, leadId)).get() ?? null;
  const opportunity =
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.leadId, leadId))
      .get() ?? null;
  const contact = account
    ? db.select().from(contacts).where(eq(contacts.accountId, account.id)).get() ??
      null
    : null;
  const acts = opportunity
    ? db
        .select()
        .from(activities)
        .where(eq(activities.opportunityId, opportunity.id))
        .all()
    : [];
  return {
    lead,
    account,
    contact,
    opportunity,
    activities: acts,
    timeline: leadTimeline(db, leadId),
  };
}

/** R2：顶栏合计必须能与各 run、台账逐行对上。 */
export function usageBreakdown(sqlite: SqliteHandle): {
  total: number;
  cny: number;
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
} {
  const totals = usageTotals(sqlite);
  const runs = sqlite
    .prepare(
      `SELECT id, lead_id AS leadId, agent_id AS agentId,
              prompt_tokens AS promptTokens, completion_tokens AS completionTokens,
              estimated_cny AS estimatedCny
       FROM agent_runs ORDER BY started_at, id`,
    )
    .all() as {
    id: string;
    leadId: string;
    agentId: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCny: number;
  }[];
  const runSum = runs.reduce(
    (s, r) => s + r.promptTokens + r.completionTokens,
    0,
  );
  const ledger = sqlite
    .prepare(
      `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS n
       FROM token_ledger`,
    )
    .get() as { n: number };
  return {
    total: totals.total,
    cny: totals.cny,
    runSum,
    ledgerSum: Number(ledger.n),
    runs,
  };
}
