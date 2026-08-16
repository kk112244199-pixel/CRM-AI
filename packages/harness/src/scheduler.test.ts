import { afterAll, describe, expect, it } from "vitest";
import {
  accounts,
  activities,
  bootstrapMemoryDb,
  closeDb,
  leads,
  opportunities,
} from "@hengce/domain";
import { eq } from "drizzle-orm";
import { HarnessError } from "./errors";
import {
  abortRun,
  advanceStage,
  confirmHandoff,
  ingestLead,
  leadTimeline,
  rejectHandoff,
  usageBreakdown,
  type HarnessCtx,
} from "./scheduler";
import { scriptedRunner } from "./scripted-runner";

const CHENGGUO = "lead-chengguo";
const HANGCHI = "lead-hangchi";

function ctx(): HarnessCtx & { close: () => void } {
  const opened = bootstrapMemoryDb();
  return {
    db: opened.db,
    sqlite: opened.sqlite,
    runner: scriptedRunner(),
    close: () => closeDb(opened.sqlite),
  };
}

function chengguoActs(c: HarnessCtx) {
  const opp = c.db
    .select()
    .from(opportunities)
    .where(eq(opportunities.leadId, CHENGGUO))
    .get();
  if (!opp) return [];
  return c.db
    .select()
    .from(activities)
    .where(eq(activities.opportunityId, opp.id))
    .all();
}

describe("M2 顺序切片（无密钥）", () => {
  const c = ctx();
  afterAll(() => c.close());

  it("橙果 ingest：分配、建档自动，转化待确认，无三对象，不拉跟进", async () => {
    await ingestLead(c, {
      leadId: CHENGGUO,
      text: "林校长想给三个校区上销售跟进台账",
      role: "sales",
    });
    const hs = leadTimeline(c.db, CHENGGUO);
    expect(hs.map((h) => h.agentId)).toEqual([
      "orchestrator",
      "lead-intake",
      "pipeline",
    ]);
    expect(hs[0]?.status).toBe("已生效");
    expect(hs[1]?.status).toBe("已生效");
    expect(hs[2]?.status).toBe("待确认");
    expect(hs[2]?.hitlKind).toBe("confirm-convert");
    expect(hs.some((h) => h.agentId === "followup")).toBe(false);
    expect(
      c.db.select().from(accounts).where(eq(accounts.leadId, CHENGGUO)).all(),
    ).toHaveLength(0);
    const lead = c.db.select().from(leads).where(eq(leads.id, CHENGGUO)).get();
    expect(lead?.status).toBe("新线索");
    expect(lead?.ownerUserId).toBe("user-sales-chen");
  });

  it("确认转化后才有三对象与跟进待发出；确认发出后电话生效", async () => {
    const pending = leadTimeline(c.db, CHENGGUO).find(
      (h) => h.hitlKind === "confirm-convert",
    )!;
    await confirmHandoff(c, { handoffId: pending.id, role: "sales" });
    expect(
      c.db.select().from(accounts).where(eq(accounts.leadId, CHENGGUO)).get()
        ?.name,
    ).toBe("橙果素质教育");
    expect(
      c.db
        .select()
        .from(opportunities)
        .where(eq(opportunities.leadId, CHENGGUO))
        .get()?.stage,
    ).toBe("需求确认");
    const send = leadTimeline(c.db, CHENGGUO).find(
      (h) => h.hitlKind === "confirm-send",
    )!;
    expect(send.status).toBe("待确认");
    const draft = chengguoActs(c);
    expect(draft).toHaveLength(1);
    expect(draft[0]?.type).toBe("电话");
    expect(draft[0]?.effective).toBe(0);

    await confirmHandoff(c, { handoffId: send.id, role: "sales" });
    expect(chengguoActs(c)[0]?.effective).toBe(1);
    expect(leadTimeline(c.db, CHENGGUO).map((h) => h.agentId)).toEqual([
      "orchestrator",
      "lead-intake",
      "pipeline",
      "followup",
    ]);
  });

  it("Token 合计等于 agent_runs 之和且等于 token_ledger 之和", () => {
    const u = usageBreakdown(c.sqlite);
    expect(u.total).toBe(u.runSum);
    expect(u.total).toBe(u.ledgerSum);
    expect(u.total).toBeGreaterThan(0);
    const fromRuns = u.runs.reduce(
      (s, r) => s + r.promptTokens + r.completionTokens,
      0,
    );
    expect(fromRuns).toBe(u.total);
  });
});

describe("闸门与失败", () => {
  it("拒绝转化不建客户也不跟进", async () => {
    const c = ctx();
    await ingestLead(c, { leadId: CHENGGUO, text: "拒", role: "sales" });
    const conv = leadTimeline(c.db, CHENGGUO).find(
      (h) => h.hitlKind === "confirm-convert",
    )!;
    rejectHandoff(c, { handoffId: conv.id, role: "sales" });
    expect(
      c.db.select().from(accounts).where(eq(accounts.leadId, CHENGGUO)).all(),
    ).toHaveLength(0);
    expect(
      leadTimeline(c.db, CHENGGUO).some((h) => h.agentId === "followup"),
    ).toBe(false);
    c.close();
  });

  it("viewer 不能 ingest；销售不能确认赢单", async () => {
    const c = ctx();
    await expect(
      ingestLead(c, { leadId: CHENGGUO, text: "x", role: "viewer" }),
    ).rejects.toBeInstanceOf(HarnessError);

    advanceStage(c, { leadId: HANGCHI, stage: "赢单", role: "sales" });
    const win = leadTimeline(c.db, HANGCHI).find(
      (h) => h.hitlKind === "confirm-win-loss" && h.status === "待确认",
    )!;
    await expect(
      confirmHandoff(c, { handoffId: win.id, role: "sales" }),
    ).rejects.toMatchObject({ status: 403 });
    await confirmHandoff(c, { handoffId: win.id, role: "manager" });
    expect(
      c.db
        .select()
        .from(opportunities)
        .where(eq(opportunities.leadId, HANGCHI))
        .get()?.stage,
    ).toBe("赢单");
    c.close();
  });

  it("销售可自推谈判", () => {
    const c = ctx();
    advanceStage(c, { leadId: HANGCHI, stage: "谈判", role: "sales" });
    expect(
      c.db
        .select()
        .from(opportunities)
        .where(eq(opportunities.leadId, HANGCHI))
        .get()?.stage,
    ).toBe("谈判");
    c.close();
  });

  it("已转化线索禁止再次 ingest", async () => {
    const c = ctx();
    await expect(
      ingestLead(c, { leadId: HANGCHI, text: "x", role: "sales" }),
    ).rejects.toMatchObject({ status: 409 });
    c.close();
  });
});

describe("ACL / 坏 JSON / 中止", () => {
  it("orchestrator 写 accounts 被拒绝并记审计，不继续建档", async () => {
    const opened = bootstrapMemoryDb();
    const c: HarnessCtx = {
      db: opened.db,
      sqlite: opened.sqlite,
      runner: scriptedRunner({
        orchestrator: JSON.stringify({
          summary: "越权",
          ownerUserId: "user-sales-chen",
          writes: [{ table: "accounts" }],
        }),
      }),
    };
    await ingestLead(c, { leadId: CHENGGUO, text: "x", role: "sales" });
    const hs = leadTimeline(c.db, CHENGGUO);
    expect(hs).toHaveLength(1);
    expect(hs[0]?.status).toBe("失败");
    expect(
      opened.sqlite
        .prepare(`SELECT COUNT(*) AS n FROM audit_events WHERE action = 'acl-deny'`)
        .get() as { n: number },
    ).toEqual({ n: 1 });
    expect(
      c.db.select().from(leads).where(eq(leads.id, CHENGGUO)).get()?.ownerUserId,
    ).toBeNull();
    closeDb(opened.sqlite);
  });

  it("建档不得写 stage，后续不跑商机", async () => {
    const opened = bootstrapMemoryDb();
    const c: HarnessCtx = {
      db: opened.db,
      sqlite: opened.sqlite,
      runner: scriptedRunner({
        "lead-intake": JSON.stringify({
          summary: "建档却写阶段",
          leadFields: { company: "橙果素质教育" },
          stage: "需求确认",
        }),
      }),
    };
    await ingestLead(c, { leadId: CHENGGUO, text: "x", role: "sales" });
    const hs = leadTimeline(c.db, CHENGGUO);
    expect(hs.map((h) => h.agentId)).toEqual(["orchestrator", "lead-intake"]);
    expect(hs[1]?.status).toBe("失败");
    expect(
      opened.sqlite
        .prepare(`SELECT COUNT(*) AS n FROM audit_events WHERE action = 'acl-deny'`)
        .get() as { n: number },
    ).toEqual({ n: 1 });
    closeDb(opened.sqlite);
  });

  it("建档 searchTags 为数组时仍能写入，不炸 SQLite 绑定", async () => {
    const opened = bootstrapMemoryDb();
    const c: HarnessCtx = {
      db: opened.db,
      sqlite: opened.sqlite,
      runner: scriptedRunner({
        "lead-intake": JSON.stringify({
          summary: "建档完成：橙果素质教育",
          leadFields: {
            company: "橙果素质教育",
            industry: "区域教培连锁",
            contactName: "林校长",
            sourceSummary: "三个校区要台账",
            searchTags: ["教培", "校区", "连锁"],
          },
        }),
      }),
    };
    await ingestLead(c, { leadId: CHENGGUO, text: "x", role: "sales" });
    const lead = c.db.select().from(leads).where(eq(leads.id, CHENGGUO)).get();
    expect(lead?.searchTags).toBe("教培,校区,连锁");
    const hs = leadTimeline(c.db, CHENGGUO);
    expect(hs.find((h) => h.agentId === "lead-intake")?.status).toBe("已生效");
    closeDb(opened.sqlite);
  });

  it("跟进不得改 opp.stage", async () => {
    const opened = bootstrapMemoryDb();
    const c: HarnessCtx = {
      db: opened.db,
      sqlite: opened.sqlite,
      runner: scriptedRunner({
        followup: JSON.stringify({
          summary: "跟进却改阶段",
          action: "draft_activity",
          stage: "赢单",
          activity: { type: "电话", text: "x" },
        }),
      }),
    };
    await ingestLead(c, { leadId: CHENGGUO, text: "x", role: "sales" });
    const conv = leadTimeline(c.db, CHENGGUO).find(
      (h) => h.hitlKind === "confirm-convert",
    )!;
    await confirmHandoff(c, { handoffId: conv.id, role: "sales" });
    const hs = leadTimeline(c.db, CHENGGUO);
    const fu = hs.find((h) => h.agentId === "followup");
    expect(fu?.status).toBe("失败");
    expect(
      c.db
        .select()
        .from(opportunities)
        .where(eq(opportunities.leadId, CHENGGUO))
        .get()?.stage,
    ).toBe("需求确认");
    expect(chengguoActs(c)).toHaveLength(0);
    closeDb(opened.sqlite);
  });

  it("非法 JSON 失败可见，后续不改库", async () => {
    const opened = bootstrapMemoryDb();
    const c: HarnessCtx = {
      db: opened.db,
      sqlite: opened.sqlite,
      runner: scriptedRunner({
        "lead-intake": "这不是 JSON",
      }),
    };
    await ingestLead(c, { leadId: CHENGGUO, text: "x", role: "sales" });
    const hs = leadTimeline(c.db, CHENGGUO);
    expect(hs.map((h) => h.agentId)).toEqual(["orchestrator", "lead-intake"]);
    expect(hs[1]?.status).toBe("失败");
    expect(hs.some((h) => h.agentId === "pipeline")).toBe(false);
    closeDb(opened.sqlite);
  });

  it("abort 清排队并保留历史 handoff", async () => {
    const c = ctx();
    await ingestLead(c, { leadId: CHENGGUO, text: "x", role: "sales" });
    const run = c.sqlite
      .prepare(`SELECT id FROM agent_runs WHERE lead_id = ? LIMIT 1`)
      .get(CHENGGUO) as { id: string };
    abortRun(c, { runId: run.id, role: "sales" });
    const hs = leadTimeline(c.db, CHENGGUO);
    expect(hs.length).toBeGreaterThan(0);
    expect(hs.filter((h) => h.status === "已生效").length).toBeGreaterThan(0);
    expect(hs.some((h) => h.status === "待确认")).toBe(false);
    expect(hs.some((h) => h.status === "已中止")).toBe(true);
    expect(
      c.db.select().from(leads).where(eq(leads.id, CHENGGUO)).get()
        ?.lastActivity,
    ).toMatch(/中止/);
    c.close();
  });
});
