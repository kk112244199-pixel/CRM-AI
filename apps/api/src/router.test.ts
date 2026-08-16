import { afterAll, describe, expect, it } from "vitest";
import { bootstrapMemoryDb, closeDb, accounts, leads } from "@hengce/domain";
import { scriptedRunner } from "@hengce/harness";
import { handleApi, type ApiCtx } from "./router";

function ctx(): ApiCtx & { close: () => void } {
  const opened = bootstrapMemoryDb();
  return {
    db: opened.db,
    sqlite: opened.sqlite,
    runner: scriptedRunner(),
    runnerKind: "scripted",
    close: () => closeDb(opened.sqlite),
  };
}

describe("M2 HTTP 顺序切片", () => {
  const c = ctx();
  afterAll(() => c.close());

  it("GET /api/health 含 runner，不含密钥", async () => {
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/health",
      headers: {},
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatch(/"ok":true/);
    expect(res.body).toMatch(/"runner":"scripted"/);
    expect(res.body).not.toMatch(/CURSOR_API_KEY/);
    expect(res.body).not.toMatch(/DASHSCOPE_API_KEY/);
    expect(res.body).not.toMatch(/cursor_/);
  });

  it("POST /api/leads/ingest 顺序交卷到转化待确认，不并行跟进", async () => {
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/ingest",
      headers: { "x-hengce-role": "sales" },
      body: JSON.stringify({
        leadId: "lead-chengguo",
        text: "林校长想给三个校区上销售跟进台账",
      }),
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as {
      card: {
        account: unknown;
        timeline: { agentId: string; status: string; hitlKind: string | null }[];
      };
    };
    expect(body.card.account).toBeNull();
    expect(body.card.timeline.map((h) => h.agentId)).toEqual([
      "orchestrator",
      "lead-intake",
      "pipeline",
    ]);
    expect(body.card.timeline[2]?.status).toBe("待确认");
  });

  it("viewer ingest 403", async () => {
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/ingest",
      headers: { "x-hengce-role": "viewer" },
      body: JSON.stringify({ leadId: "lead-chengguo", text: "x" }),
    });
    expect(res.status).toBe(403);
  });

  it("确认转化后再出现跟进待发出；usage 合计等于各 run", async () => {
    const got = await handleApi(c, {
      method: "GET",
      url: "/api/leads/lead-chengguo",
      headers: {},
    });
    const card = JSON.parse(got.body) as {
      timeline: { id: string; hitlKind: string | null }[];
    };
    const conv = card.timeline.find((h) => h.hitlKind === "confirm-convert");
    const confirmed = await handleApi(c, {
      method: "POST",
      url: `/api/handoffs/${conv!.id}/confirm`,
      headers: { "x-hengce-role": "sales" },
      body: "{}",
    });
    expect(confirmed.status).toBe(200);
    const after = await handleApi(c, {
      method: "GET",
      url: "/api/leads/lead-chengguo",
      headers: {},
    });
    const afterCard = JSON.parse(after.body) as {
      account: { name: string } | null;
      timeline: {
        id: string;
        agentId: string;
        status: string;
        hitlKind: string | null;
      }[];
    };
    expect(afterCard.account?.name).toBe("橙果素质教育");
    const send = afterCard.timeline.find((h) => h.hitlKind === "confirm-send");
    expect(send?.status).toBe("待确认");

    const sent = await handleApi(c, {
      method: "POST",
      url: `/api/handoffs/${send!.id}/confirm`,
      headers: { "x-hengce-role": "sales" },
      body: "{}",
    });
    expect(sent.status).toBe(200);
    const done = await handleApi(c, {
      method: "GET",
      url: "/api/leads/lead-chengguo",
      headers: {},
    });
    const doneCard = JSON.parse(done.body) as {
      activities: { type: string; effective: number }[];
    };
    expect(doneCard.activities.some((a) => a.type === "电话" && a.effective === 1)).toBe(
      true,
    );

    const usage = await handleApi(c, {
      method: "GET",
      url: "/api/usage",
      headers: {},
    });
    const u = JSON.parse(usage.body) as {
      total: number;
      runSum: number;
      ledgerSum: number;
    };
    expect(u.total).toBe(u.runSum);
    expect(u.total).toBe(u.ledgerSum);
  });
});

describe("M3 HTTP 阶段与 R5", () => {
  it("viewer 推进阶段 403，库不变", async () => {
    const c = ctx();
    const before = await handleApi(c, {
      method: "GET",
      url: "/api/leads/lead-hangchi",
      headers: {},
    });
    const stageBefore = (
      JSON.parse(before.body) as { opportunity: { stage: string } }
    ).opportunity.stage;
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/lead-hangchi/stage",
      headers: { "x-hengce-role": "viewer" },
      body: JSON.stringify({ stage: "谈判" }),
    });
    expect(res.status).toBe(403);
    const after = await handleApi(c, {
      method: "GET",
      url: "/api/leads/lead-hangchi",
      headers: {},
    });
    expect(
      (JSON.parse(after.body) as { opportunity: { stage: string } }).opportunity
        .stage,
    ).toBe(stageBefore);
    c.close();
  });

  it("杭齿建议赢单须 manager 确认", async () => {
    const c = ctx();
    const propose = await handleApi(c, {
      method: "POST",
      url: "/api/leads/lead-hangchi/stage",
      headers: { "x-hengce-role": "sales" },
      body: JSON.stringify({ stage: "赢单" }),
    });
    expect(propose.status).toBe(200);
    const pending = await handleApi(c, {
      method: "GET",
      url: "/api/handoffs/pending",
      headers: {},
    });
    const items = (
      JSON.parse(pending.body) as {
        items: { id: string; hitlKind: string; leadId: string }[];
      }
    ).items;
    const win = items.find(
      (h) => h.leadId === "lead-hangchi" && h.hitlKind === "confirm-win-loss",
    )!;
    const asSales = await handleApi(c, {
      method: "POST",
      url: `/api/handoffs/${win.id}/confirm`,
      headers: { "x-hengce-role": "sales" },
      body: "{}",
    });
    expect(asSales.status).toBe(403);
    const asMgr = await handleApi(c, {
      method: "POST",
      url: `/api/handoffs/${win.id}/confirm`,
      headers: { "x-hengce-role": "manager" },
      body: "{}",
    });
    expect(asMgr.status).toBe(200);
    const card = await handleApi(c, {
      method: "GET",
      url: "/api/leads/lead-hangchi",
      headers: {},
    });
    expect(
      (JSON.parse(card.body) as { opportunity: { stage: string } }).opportunity
        .stage,
    ).toBe("赢单");
    c.close();
  });
});

describe("S10 HTTP 筛选与 CSV 导入", () => {
  it("GET /api/leads?status=新线索 含橙果、无已转化", async () => {
    const c = ctx();
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/leads?status=" + encodeURIComponent("新线索"),
      headers: {},
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as {
      leads: { company: string; status: string }[];
    };
    expect(body.leads.some((l) => l.company === "橙果素质教育")).toBe(true);
    expect(body.leads.every((l) => l.status === "新线索")).toBe(true);
    c.close();
  });

  it("GET /api/leads?stage=方案报价 含杭齿与邻里鲜", async () => {
    const c = ctx();
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/leads?stage=" + encodeURIComponent("方案报价"),
      headers: {},
    });
    expect(res.status).toBe(200);
    const names = (
      JSON.parse(res.body) as { leads: { company: string }[] }
    ).leads.map((l) => l.company);
    expect(names).toContain("杭齿精密机电");
    expect(names).toContain("邻里鲜超市");
    c.close();
  });

  it("GET /api/leads?stage=not-a-stage 400", async () => {
    const c = ctx();
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/leads?stage=not-a-stage",
      headers: {},
    });
    expect(res.status).toBe(400);
    c.close();
  });

  it("POST /api/leads/import viewer 403", async () => {
    const c = ctx();
    const before = c.db.select().from(leads).all().length;
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/import",
      headers: { "x-hengce-role": "viewer" },
      body: JSON.stringify({
        csv: "company,industry,contactName,sourceSummary\nA,B,C,D",
      }),
    });
    expect(res.status).toBe(403);
    expect(c.db.select().from(leads).all().length).toBe(before);
    c.close();
  });

  it("POST /api/leads/import sales 插入新线索、跳过橙果、无 account", async () => {
    const c = ctx();
    const accBefore = c.db.select().from(accounts).all().length;
    const csv = [
      "company,industry,contactName,sourceSummary",
      "HTTP导入一,行业,联系人,摘要",
      "橙果素质教育,教培,林校长,重复",
      "HTTP导入二,行业,联系人,摘要",
    ].join("\n");
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/import",
      headers: { "x-hengce-role": "sales" },
      body: JSON.stringify({ csv }),
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as {
      ok: boolean;
      imported: { company: string }[];
      skipped: { company: string }[];
    };
    expect(body.ok).toBe(true);
    expect(body.imported.map((r) => r.company)).toEqual([
      "HTTP导入一",
      "HTTP导入二",
    ]);
    expect(body.skipped.some((s) => s.company === "橙果素质教育")).toBe(true);
    expect(c.db.select().from(accounts).all().length).toBe(accBefore);
    const row = c.db
      .select()
      .from(leads)
      .all()
      .find((l) => l.company === "HTTP导入一");
    expect(row?.status).toBe("新线索");
    expect(row?.lastActivity).toBe("CSV 导入");
    c.close();
  });

  it("GET /api/leads/import 不被当作线索 id", async () => {
    const c = ctx();
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/leads/import",
      headers: {},
    });
    expect(res.status).toBe(404);
    c.close();
  });
});
