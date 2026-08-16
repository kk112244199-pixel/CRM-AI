import { afterAll, describe, expect, it } from "vitest";
import {
  ACTIVITY_TYPES,
  COMPANY_NAMES,
  OPP_STAGES,
  accounts,
  activities,
  agentMayWrite,
  bootstrapMemoryDb,
  closeDb,
  contacts,
  leads,
  opportunities,
} from "../src/index";

const opened = bootstrapMemoryDb();
afterAll(() => closeDb(opened.sqlite));

describe("schema 与种子", () => {
  it("能建表：sqlite_master 含契约表", () => {
    const names = opened.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const set = new Set(names.map((n) => n.name));
    for (const t of [
      "users",
      "leads",
      "accounts",
      "contacts",
      "opportunities",
      "activities",
      "agent_runs",
      "handoffs",
      "token_ledger",
      "audit_events",
      "documents",
    ]) {
      expect(set.has(t)).toBe(true);
    }
    expect(set.has("quotes")).toBe(false);
    expect(set.has("contracts")).toBe(false);
    expect(set.has("wallets")).toBe(false);
    expect(set.has("vec_leads")).toBe(true);
  });

  it("documents 无向量列", () => {
    const cols = opened.sqlite
      .prepare("PRAGMA table_info(documents)")
      .all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("embedding");
    expect(cols.map((c) => c.name)).not.toContain("vector");
  });

  it("八家名字一字不改", () => {
    const rows = opened.db.select({ company: leads.company }).from(leads).all();
    expect(rows.map((r) => r.company).sort()).toEqual([...COMPANY_NAMES].sort());
  });

  it("橙果素质教育未转化且无三张对象", () => {
    const lead = opened.db
      .select()
      .from(leads)
      .all()
      .find((l) => l.company === "橙果素质教育");
    expect(lead?.status).toBe("新线索");
    const acc = opened.db
      .select()
      .from(accounts)
      .all()
      .filter((a) => a.leadId === "lead-chengguo");
    expect(acc).toHaveLength(0);
    const opps = opened.db
      .select()
      .from(opportunities)
      .all()
      .filter((o) => o.leadId === "lead-chengguo");
    expect(opps).toHaveLength(0);
  });

  it("其余七家各有客户+联系人+商机，阶段中文", () => {
    const converted = opened.db
      .select()
      .from(leads)
      .all()
      .filter((l) => l.company !== "橙果素质教育");
    expect(converted).toHaveLength(7);
    const accs = opened.db.select().from(accounts).all();
    const cts = opened.db.select().from(contacts).all();
    const opps = opened.db.select().from(opportunities).all();
    expect(accs).toHaveLength(7);
    expect(cts).toHaveLength(7);
    expect(opps).toHaveLength(7);
    for (const lead of converted) {
      expect(lead.status).toBe("已转化");
      const acc = accs.find((a) => a.leadId === lead.id);
      expect(acc).toBeTruthy();
      expect(cts.some((c) => c.accountId === acc!.id)).toBe(true);
      const opp = opps.find((o) => o.leadId === lead.id);
      expect(opp).toBeTruthy();
      expect(OPP_STAGES).toContain(opp!.stage);
      expect(opp!.stage).not.toMatch(/Discovery|Demo/i);
    }
  });

  it("阶段按 PRD 落库", () => {
    const opps = opened.db.select().from(opportunities).all();
    const accs = opened.db.select().from(accounts).all();
    const stageOf = (company: string) => {
      const acc = accs.find((a) => a.name === company);
      return opps.find((o) => o.accountId === acc?.id)?.stage;
    };
    expect(stageOf("杭齿精密机电")).toBe("方案报价");
    expect(stageOf("嘉兴精工装备")).toBe("需求确认");
    expect(stageOf("澄海医疗器械")).toBe("谈判");
    expect(stageOf("邻里鲜超市")).toBe("方案报价");
    expect(stageOf("夜灯便利")).toBe("需求确认");
    expect(stageOf("海图进出口")).toBe("谈判");
    expect(stageOf("江东水务物资")).toBe("丢单");
  });

  it("活动 type 只在四枚举内", () => {
    const acts = opened.db.select().from(activities).all();
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) {
      expect(ACTIVITY_TYPES).toContain(a.type);
    }
  });

  it("users 含三角色", () => {
    const roles = opened.sqlite
      .prepare("SELECT DISTINCT role FROM users")
      .all() as { role: string }[];
    expect(roles.map((r) => r.role).sort()).toEqual(
      ["manager", "sales", "viewer"].sort(),
    );
  });
});

describe("ACL 约定（M2 执行）", () => {
  it("系统分配不得写客户三表；跟进不得写商机阶段表", () => {
    expect(agentMayWrite("orchestrator", "accounts")).toBe(false);
    expect(agentMayWrite("orchestrator", "contacts")).toBe(false);
    expect(agentMayWrite("orchestrator", "opportunities")).toBe(false);
    expect(agentMayWrite("orchestrator", "activities")).toBe(false);
    expect(agentMayWrite("followup", "opportunities")).toBe(false);
    expect(agentMayWrite("pipeline", "activities")).toBe(false);
    expect(agentMayWrite("lead-intake", "leads")).toBe(true);
  });
});
