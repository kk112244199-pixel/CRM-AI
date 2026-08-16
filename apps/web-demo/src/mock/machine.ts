import type {
  AgentId,
  DemoEvent,
  DemoState,
  Handoff,
  HitlKind,
  OppStage,
  Role,
} from "./types";

const TOKEN_TABLE: Record<
  AgentId,
  { prompt: number; completion: number; cny: number }
> = {
  orchestrator: { prompt: 120, completion: 80, cny: 0.04 },
  "lead-intake": { prompt: 400, completion: 220, cny: 0.12 },
  pipeline: { prompt: 300, completion: 160, cny: 0.09 },
  followup: { prompt: 350, completion: 190, cny: 0.11 },
};

function nextId(state: DemoState, prefix: string): { id: string; seq: number } {
  return { id: `${prefix}-${state.seq}`, seq: state.seq + 1 };
}

function canMutate(role: Role): boolean {
  return role !== "viewer";
}

function canConfirm(role: Role, kind: HitlKind | null): boolean {
  if (role === "viewer" || kind === null) return false;
  if (kind === "confirm-win-loss") return role === "manager";
  return role === "sales" || role === "manager";
}

function sliceBusy(state: DemoState, leadId: string): boolean {
  if (state.pendingArrival[leadId]) return true;
  return state.handoffs.some(
    (h) =>
      h.leadId === leadId &&
      (h.status === "待确认" || h.status === "进行中"),
  );
}

function oppOf(state: DemoState, leadId: string) {
  return state.opportunities.find((o) => o.leadId === leadId);
}

function makeHandoff(
  state: DemoState,
  leadId: string,
  agent: AgentId,
  status: Handoff["status"],
  summary: string,
  hitlKind: HitlKind | null,
  proposedStage: OppStage | null = null,
): { handoff: Handoff; seq: number } {
  const { id, seq } = nextId(state, "h");
  const tok = TOKEN_TABLE[agent];
  return {
    seq,
    handoff: {
      id,
      leadId,
      agent,
      status,
      summary,
      promptTokens: tok.prompt,
      completionTokens: tok.completion,
      estimatedCny: tok.cny,
      hitlKind,
      proposedStage,
    },
  };
}

export function tokenSum(handoffs: Handoff[]): {
  total: number;
  cny: number;
  byAgent: Record<AgentId, number>;
} {
  const byAgent: Record<AgentId, number> = {
    orchestrator: 0,
    "lead-intake": 0,
    pipeline: 0,
    followup: 0,
  };
  let total = 0;
  let cny = 0;
  for (const h of handoffs) {
    const n = h.promptTokens + h.completionTokens;
    total += n;
    cny += h.estimatedCny;
    byAgent[h.agent] += n;
  }
  return { total, cny, byAgent };
}

export function pendingHandoffs(state: DemoState): Handoff[] {
  return state.handoffs.filter((h) => h.status === "待确认");
}

export function leadHandoffs(state: DemoState, leadId: string): Handoff[] {
  return state.handoffs.filter((h) => h.leadId === leadId);
}

/**
 * 给 React 排下一卷用的依赖键。必须带上 agent：
 * 同一条线索会连续排队（建档 → 商机），leadId 不变、只换角色；
 * 若只序列化 leadId，建档自动生效后永远等不到转化建议。
 */
export function pendingArrivalKey(
  pending: DemoState["pendingArrival"],
): string {
  return Object.entries(pending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, agent]) => `${id}:${agent}`)
    .join(",");
}

export function reduce(state: DemoState, event: DemoEvent): DemoState {
  switch (event.type) {
    case "set-role":
      return { ...state, role: event.role };
    case "start-slice":
      return startSlice(state, event.leadId, event.text);
    case "arrive":
      return arrive(state, event.leadId);
    case "confirm":
      return confirmHandoff(state, event.handoffId);
    case "reject":
      return rejectHandoff(state, event.handoffId);
    case "abort":
      return abortLead(state, event.leadId);
    case "advance-stage":
      return advanceStage(state, event.leadId, event.stage);
    default:
      return state;
  }
}

function patchLead(
  state: DemoState,
  leadId: string,
  lastActivity: string,
  extra: Partial<DemoState["leads"][number]> = {},
): DemoState["leads"] {
  return state.leads.map((l) =>
    l.id === leadId ? { ...l, lastActivity, ...extra } : l,
  );
}

function startSlice(state: DemoState, leadId: string, text: string): DemoState {
  if (!canMutate(state.role)) return state;
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead || !text.trim() || sliceBusy(state, leadId)) return state;
  if (lead.status === "已转化") return state;

  const made = makeHandoff(
    state,
    leadId,
    "orchestrator",
    "已生效",
    `系统分配给销售-陈。禁止本步写客户/联系人/商机。录入：${text.trim()}`,
    null,
  );

  return {
    ...state,
    seq: made.seq,
    leads: patchLead(state, leadId, "已分配，等待建档", {
      owner: "销售-陈",
      draftIngest: text.trim(),
    }),
    handoffs: [...state.handoffs, made.handoff],
    pendingArrival: { ...state.pendingArrival, [leadId]: "lead-intake" },
  };
}

function arrive(state: DemoState, leadId: string): DemoState {
  const agent = state.pendingArrival[leadId];
  if (!agent) return state;
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return state;
  const restPending = { ...state.pendingArrival };
  delete restPending[leadId];

  if (agent === "lead-intake") {
    // 建档低风险：自动生效，仍单独交一卷，体现分工
    const made = makeHandoff(
      state,
      leadId,
      "lead-intake",
      "已生效",
      `建档完成：${lead.company}，联系人 ${lead.contactName}，来源「${lead.draftIngest || lead.sourceSummary}」。未转化，无商机。`,
      null,
    );
    return {
      ...state,
      seq: made.seq,
      handoffs: [...state.handoffs, made.handoff],
      leads: patchLead(state, leadId, "建档已自动生效", {
        sourceSummary: lead.draftIngest || lead.sourceSummary,
      }),
      pendingArrival: { ...restPending, [leadId]: "pipeline" },
    };
  }

  if (agent === "pipeline") {
    const made = makeHandoff(
      state,
      leadId,
      "pipeline",
      "待确认",
      `转化建议：客户「${lead.company}」+ 联系人「${lead.contactName}」+ 商机「衡策销管」进入需求确认。资格：有明确校区需求（演示）。销售确认后才拆三张对象。`,
      "confirm-convert",
    );
    return {
      ...state,
      seq: made.seq,
      handoffs: [...state.handoffs, made.handoff],
      pendingArrival: restPending,
    };
  }

  if (agent === "followup") {
    const made = makeHandoff(
      state,
      leadId,
      "followup",
      "待确认",
      `跟进草稿，类型：电话。话术：${lead.contactName} 您好，衡策销管可先把校区线索收进台账，约 30 分钟演示。确认发出前不算活动。报价/合同首版不做。`,
      "confirm-send",
    );
    return {
      ...state,
      seq: made.seq,
      handoffs: [...state.handoffs, made.handoff],
      pendingArrival: restPending,
    };
  }

  return { ...state, pendingArrival: restPending };
}

function confirmHandoff(state: DemoState, handoffId: string): DemoState {
  const h = state.handoffs.find((x) => x.id === handoffId);
  if (!h || h.status !== "待确认") return state;
  if (!canConfirm(state.role, h.hitlKind)) return state;
  const lead = state.leads.find((l) => l.id === h.leadId);
  if (!lead) return state;

  const handoffs = state.handoffs.map((x) =>
    x.id === handoffId ? { ...x, status: "已生效" as const } : x,
  );

  if (h.hitlKind === "confirm-convert") {
    return applyConvert({ ...state, handoffs }, lead.id);
  }

  if (h.hitlKind === "confirm-send") {
    const opp = oppOf(state, lead.id);
    if (!opp) return { ...state, handoffs };
    const { id, seq } = nextId({ ...state, seq: state.seq }, "act");
    const pendingArrival = { ...state.pendingArrival };
    delete pendingArrival[lead.id];
    return {
      ...state,
      seq,
      handoffs,
      pendingArrival,
      activities: [
        ...state.activities,
        {
          id,
          opportunityId: opp.id,
          type: "电话",
          text: `电话邀约 ${lead.contactName} 做产品演示`,
          effective: true,
        },
      ],
      leads: patchLead(state, lead.id, "跟进活动已生效"),
    };
  }

  if (h.hitlKind === "confirm-win-loss" && h.proposedStage) {
    return {
      ...state,
      handoffs,
      opportunities: state.opportunities.map((o) =>
        o.leadId === lead.id ? { ...o, stage: h.proposedStage! } : o,
      ),
      leads: patchLead(state, lead.id, `商机已${h.proposedStage}`),
    };
  }

  return { ...state, handoffs };
}

function applyConvert(state: DemoState, leadId: string): DemoState {
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead || lead.status === "已转化") return state;
  let seq = state.seq;
  const acc = nextId({ ...state, seq }, "acc");
  seq = acc.seq;
  const ct = nextId({ ...state, seq }, "ct");
  seq = ct.seq;
  const op = nextId({ ...state, seq }, "opp");
  seq = op.seq;
  return {
    ...state,
    seq,
    accounts: [
      ...state.accounts,
      { id: acc.id, name: lead.company, leadId },
    ],
    contacts: [
      ...state.contacts,
      {
        id: ct.id,
        accountId: acc.id,
        name: lead.contactName,
        title: "联系人",
      },
    ],
    opportunities: [
      ...state.opportunities,
      {
        id: op.id,
        accountId: acc.id,
        contactId: ct.id,
        leadId,
        name: `${lead.company} / 衡策销管`,
        stage: "需求确认",
      },
    ],
    leads: patchLead(state, leadId, "已转化为客户+联系人+商机", {
      status: "已转化",
    }),
    pendingArrival: { ...state.pendingArrival, [leadId]: "followup" },
  };
}

function rejectHandoff(state: DemoState, handoffId: string): DemoState {
  const h = state.handoffs.find((x) => x.id === handoffId);
  if (!h || h.status !== "待确认") return state;
  if (!canConfirm(state.role, h.hitlKind)) return state;
  const restPending = { ...state.pendingArrival };
  delete restPending[h.leadId];
  return {
    ...state,
    pendingArrival: restPending,
    handoffs: state.handoffs.map((x) =>
      x.id === handoffId ? { ...x, status: "已拒绝" as const } : x,
    ),
    leads: patchLead(state, h.leadId, "已拒绝，后续不再追加"),
  };
}

function abortLead(state: DemoState, leadId: string): DemoState {
  if (!canMutate(state.role)) return state;
  const restPending = { ...state.pendingArrival };
  delete restPending[leadId];
  return {
    ...state,
    pendingArrival: restPending,
    leads: patchLead(state, leadId, "已中止后续，历史 handoff 保留"),
  };
}

function advanceStage(
  state: DemoState,
  leadId: string,
  stage: OppStage,
): DemoState {
  if (!canMutate(state.role)) return state;
  const opp = oppOf(state, leadId);
  if (!opp || sliceBusy(state, leadId)) return state;

  const highRisk = stage === "赢单" || stage === "丢单";
  if (highRisk) {
    const made = makeHandoff(
      state,
      leadId,
      "pipeline",
      "待确认",
      `高风险：建议商机改为「${stage}」。须主管确认。报价/合同模块首版不做。`,
      "confirm-win-loss",
      stage,
    );
    return {
      ...state,
      seq: made.seq,
      handoffs: [...state.handoffs, made.handoff],
      leads: patchLead(state, leadId, "赢单/丢单待主管确认"),
    };
  }

  return {
    ...state,
    opportunities: state.opportunities.map((o) =>
      o.leadId === leadId ? { ...o, stage } : o,
    ),
    leads: patchLead(state, leadId, `销售推进阶段至${stage}`),
  };
}
