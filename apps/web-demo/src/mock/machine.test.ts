import { describe, expect, it } from "vitest";
import { pendingArrivalKey, reduce, tokenSum } from "./machine";
import { createInitialState, SEED_LEADS, SIMILAR_HINTS } from "./seed";
import type { DemoState, Handoff } from "./types";

const CHENGGUO = "lead-chengguo";

function run(
  events: Parameters<typeof reduce>[1][],
  start: DemoState = createInitialState(),
): DemoState {
  return events.reduce((s, e) => reduce(s, e), start);
}

function ofAgent(s: DemoState, agent: Handoff["agent"]): Handoff[] {
  return s.handoffs.filter((h) => h.leadId === CHENGGUO && h.agent === agent);
}

describe("种子对象", () => {
  it("八家名字不变；橙果未转化；杭齿已有商机方案报价", () => {
    expect(SEED_LEADS.map((l) => l.company)).toEqual([
      "杭齿精密机电",
      "嘉兴精工装备",
      "澄海医疗器械",
      "橙果素质教育",
      "邻里鲜超市",
      "夜灯便利",
      "海图进出口",
      "江东水务物资",
    ]);
    const s = createInitialState();
    expect(s.leads.find((l) => l.id === CHENGGUO)?.status).toBe("新线索");
    expect(s.opportunities.find((o) => o.leadId === CHENGGUO)).toBeUndefined();
    expect(
      s.opportunities.find((o) => o.leadId === "lead-hangchi")?.stage,
    ).toBe("方案报价");
    expect(SIMILAR_HINTS["杭齿精密机电"]).toBe("嘉兴精工装备");
  });
});

describe("黄金切片：分配自动、建档自动、转化销售点、外发销售点", () => {
  it("start 后只有系统分配；arrive 建档自动生效且未拆三对象", () => {
    let s = run([
      { type: "start-slice", leadId: CHENGGUO, text: "林校长要做校区线索台账" },
    ]);
    expect(s.handoffs).toHaveLength(1);
    expect(s.handoffs[0]?.agent).toBe("orchestrator");
    expect(s.handoffs[0]?.summary).toMatch(/系统分配/);
    expect(s.leads.find((l) => l.id === CHENGGUO)?.owner).toBe("销售-陈");

    s = reduce(s, { type: "arrive", leadId: CHENGGUO });
    expect(ofAgent(s, "lead-intake")[0]?.status).toBe("已生效");
    expect(s.leads.find((l) => l.id === CHENGGUO)?.status).toBe("新线索");
    expect(s.accounts.some((a) => a.leadId === CHENGGUO)).toBe(false);
    expect(s.pendingArrival[CHENGGUO]).toBe("pipeline");
    expect(pendingArrivalKey(s.pendingArrival)).toBe(
      `${CHENGGUO}:pipeline`,
    );
    expect(pendingArrivalKey({ [CHENGGUO]: "lead-intake" })).not.toBe(
      pendingArrivalKey({ [CHENGGUO]: "pipeline" }),
    );
  });

  it("确认转化后才有客户+联系人+商机需求确认，再跟进电话活动", () => {
    let s = run([
      { type: "start-slice", leadId: CHENGGUO, text: "林校长要做校区线索台账" },
      { type: "arrive", leadId: CHENGGUO },
      { type: "arrive", leadId: CHENGGUO },
    ]);
    const conv = ofAgent(s, "pipeline")[0]!;
    expect(conv.status).toBe("待确认");
    expect(conv.hitlKind).toBe("confirm-convert");
    s = reduce(s, { type: "confirm", handoffId: conv.id });
    expect(s.leads.find((l) => l.id === CHENGGUO)?.status).toBe("已转化");
    expect(s.accounts.some((a) => a.name === "橙果素质教育")).toBe(true);
    expect(s.contacts.some((c) => c.name === "林校长")).toBe(true);
    expect(s.opportunities.find((o) => o.leadId === CHENGGUO)?.stage).toBe(
      "需求确认",
    );

    s = reduce(s, { type: "arrive", leadId: CHENGGUO });
    const send = ofAgent(s, "followup")[0]!;
    s = reduce(s, { type: "confirm", handoffId: send.id });
    expect(s.activities[0]?.type).toBe("电话");
    expect(s.activities[0]?.effective).toBe(true);
    expect(s.handoffs.filter((h) => h.leadId === CHENGGUO)).toHaveLength(4);
    expect(s.handoffs.some((h) => /Discovery/.test(h.summary))).toBe(false);
  });
});

describe("闸门", () => {
  it("销售推进方案报价无需主管；赢单须主管", () => {
    const hang = "lead-hangchi";
    let s = run([{ type: "advance-stage", leadId: hang, stage: "谈判" }]);
    expect(s.opportunities.find((o) => o.leadId === hang)?.stage).toBe("谈判");

    s = reduce(s, { type: "advance-stage", leadId: hang, stage: "赢单" });
    expect(s.opportunities.find((o) => o.leadId === hang)?.stage).toBe("谈判");
    const win = s.handoffs.find((h) => h.hitlKind === "confirm-win-loss")!;
    s = reduce(s, { type: "confirm", handoffId: win.id });
    expect(s.opportunities.find((o) => o.leadId === hang)?.stage).toBe("谈判");

    s = reduce(s, { type: "set-role", role: "manager" });
    s = reduce(s, { type: "confirm", handoffId: win.id });
    expect(s.opportunities.find((o) => o.leadId === hang)?.stage).toBe("赢单");
  });

  it("拒绝转化则不建客户，也不跟进", () => {
    let s = run([
      { type: "start-slice", leadId: CHENGGUO, text: "拒" },
      { type: "arrive", leadId: CHENGGUO },
      { type: "arrive", leadId: CHENGGUO },
    ]);
    const conv = ofAgent(s, "pipeline")[0]!;
    s = reduce(s, { type: "reject", handoffId: conv.id });
    expect(s.accounts.some((a) => a.leadId === CHENGGUO)).toBe(false);
    s = reduce(s, { type: "arrive", leadId: CHENGGUO });
    expect(ofAgent(s, "followup")).toHaveLength(0);
  });

  it("viewer 不能开切片", () => {
    const s = run([
      { type: "set-role", role: "viewer" },
      { type: "start-slice", leadId: CHENGGUO, text: "x" },
    ]);
    expect(s.handoffs).toHaveLength(0);
  });
});

describe("排队键", () => {
  it("同一线索换下一角色时键必须变，否则前端定时器不会重排", () => {
    expect(pendingArrivalKey({ [CHENGGUO]: "lead-intake" })).toBe(
      `${CHENGGUO}:lead-intake`,
    );
    expect(pendingArrivalKey({ [CHENGGUO]: "pipeline" })).toBe(
      `${CHENGGUO}:pipeline`,
    );
    expect(pendingArrivalKey({})).toBe("");
  });
});

describe("Token", () => {
  it("合计等于各条之和", () => {
    const s = run([
      { type: "start-slice", leadId: CHENGGUO, text: "t" },
      { type: "arrive", leadId: CHENGGUO },
    ]);
    const { total } = tokenSum(s.handoffs);
    expect(total).toBe(
      s.handoffs.reduce((n, h) => n + h.promptTokens + h.completionTokens, 0),
    );
  });
});
