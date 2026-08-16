import { useCallback, useEffect, useMemo, useState } from "react";
import {
  abortLead,
  advanceStage,
  ApiError,
  confirmHandoff,
  getHealth,
  getLead,
  getLeads,
  getPending,
  getSimilar,
  getUsage,
  importLeadsCsv,
  ingestLead,
  readRole,
  rejectHandoff,
  writeRole,
} from "./api";
import {
  AGENT_LABEL,
  HITL_LABEL,
  USER_LABEL,
  type AgentId,
  type Handoff,
  type Lead,
  type LeadCard,
  type OppStage,
  type PendingItem,
  type Role,
  type Usage,
} from "./types";

type Page = "list" | "detail" | "pending" | "usage" | "ingest";

type AskState = {
  title: string;
  body: string;
  yes: string;
  danger?: boolean;
  onYes: () => void;
};

type ListTab = "all" | "new" | "open" | "wait";

const STAGE_CHIPS: OppStage[] = [
  "需求确认",
  "方案报价",
  "谈判",
  "赢单",
  "丢单",
];

function leadsQueryForTab(tab: ListTab, stage: OppStage | null): {
  status?: string;
  stage?: OppStage;
} {
  const query: { status?: string; stage?: OppStage } = {};
  if (tab === "new") query.status = "新线索";
  else if (tab === "open") query.status = "已转化";
  if (stage) query.stage = stage;
  return query;
}

/** 主画面四站漏斗。展示名固定，不改调度顺序。转化站对应 pipeline（商机）。 */
const FUNNEL: { agentId: AgentId; title: string; hint: string }[] = [
  { agentId: "orchestrator", title: "系统分配", hint: "自动" },
  { agentId: "lead-intake", title: "建档", hint: "自动" },
  { agentId: "pipeline", title: "转化", hint: "商机" },
  { agentId: "followup", title: "跟进", hint: "外发" },
];

const ROLE_UI: Record<Role, string> = {
  sales: "销售",
  manager: "经理",
  viewer: "只读",
};

const DESK_USER: Record<Role, string> = {
  sales: USER_LABEL["user-sales-chen"],
  manager: USER_LABEL["user-manager-zhou"],
  viewer: USER_LABEL["user-viewer-wu"],
};

function stageLabel(lead: Lead, card: LeadCard | null): string {
  if (card?.lead.id === lead.id && card.opportunity) {
    return `商机·${card.opportunity.stage}`;
  }
  if (lead.oppStage) return `商机·${lead.oppStage}`;
  return `线索·${lead.status}`;
}

function stationClass(timeline: Handoff[], agentId: AgentId): string {
  const rows = timeline.filter((h) => h.agentId === agentId);
  if (rows.length === 0) return "idle";
  if (rows.some((h) => h.status === "待确认")) return "wait";
  const last = rows[rows.length - 1];
  if (last?.status === "已生效") return "done";
  if (last?.status === "失败") return "fail";
  return "idle";
}

function runnerLabel(kind?: string): string {
  if (kind === "qwen") return "千问交卷";
  if (kind === "cursor") return "真模型交卷";
  if (kind === "scripted") return "脚本回放";
  return kind ? `${kind}交卷` : "未接上接口";
}

export function App() {
  const [role, setRole] = useState<Role>(readRole);
  const [page, setPage] = useState<Page>("detail");
  const [leadId, setLeadId] = useState("lead-chengguo");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [card, setCard] = useState<LeadCard | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [queue, setQueue] = useState<PendingItem[]>([]);
  const [draft, setDraft] = useState("林校长想给三个校区上销售跟进台账");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState("");
  const [similarMsg, setSimilarMsg] = useState("");
  const [ask, setAsk] = useState<AskState | null>(null);
  const [booting, setBooting] = useState(true);

  const setRolePersist = (next: Role) => {
    writeRole(next);
    setRole(next);
  };

  const refreshAll = useCallback(
    async (id = leadId) => {
      const [leadRes, usageRes, pendingRes] = await Promise.all([
        getLeads(role),
        getUsage(role),
        getPending(role),
      ]);
      setLeads(leadRes.leads);
      setUsage(usageRes);
      setQueue(pendingRes.items);
      if (id) {
        const next = await getLead(role, id);
        setCard(next);
      }
    },
    [leadId, role],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const h = await getHealth(role);
        if (cancelled) return;
        setHealth(runnerLabel(h.runner));
        await refreshAll();
        if (!cancelled) setError("");
      } catch (err) {
        if (cancelled) return;
        setHealth("未接上接口");
        setError(
          err instanceof Error
            ? "接口未开。请先在仓库根目录执行 npm --prefix apps/api start"
            : "加载失败",
        );
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAll, role]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!ask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAsk(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ask]);

  const run = async (
    fn: () => Promise<void>,
    opts?: { busy?: string; ok?: string },
  ) => {
    setError("");
    setNotice("");
    setBusy(opts?.busy ?? "正在处理");
    try {
      await fn();
      await refreshAll();
      if (opts?.ok) setNotice(opts.ok);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 403
            ? "当前角色不能做这一步。赢单/丢单请切到经理；只读不能改库。"
            : `${err.status} ${err.message}`
          : err instanceof Error
            ? err.message
            : "请求失败";
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  const lead = leads.find((l) => l.id === leadId) ?? leads[0];
  const pendingIds = useMemo(
    () => new Set(queue.map((q) => q.leadId)),
    [queue],
  );
  const byAgent = useMemo(() => {
    const map: Record<string, number> = {
      orchestrator: 0,
      "lead-intake": 0,
      pipeline: 0,
      followup: 0,
    };
    for (const r of usage?.runs ?? []) {
      map[r.agentId] = (map[r.agentId] ?? 0) + r.promptTokens + r.completionTokens;
    }
    return map;
  }, [usage]);

  const openLead = (id: string) => {
    setLeadId(id);
    setPage("detail");
  };

  const locked = Boolean(busy);

  const navBtn = (id: Page, label: string) => (
    <button
      type="button"
      className={page === id ? "current" : undefined}
      aria-current={page === id ? "page" : undefined}
      onClick={() => setPage(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="app" aria-busy={locked || booting}>
      <header className="top">
        <div className="plate">
          <div className="plate-copy">
            <strong className="brand">衡策销管平台</strong>
            <span className="brand-sub">漏斗交卷</span>
          </div>
        </div>
        <nav>
          {navBtn("list", "线索列表")}
          {navBtn("detail", "线索详情")}
          {navBtn("pending", `待确认（${queue.length}）`)}
          {navBtn("usage", "用量")}
          {navBtn("ingest", "录入")}
        </nav>
        <div className="top-right">
          <span className="token-chip">
            台账 Token 合计 <b>{usage?.total ?? 0}</b> ·{" "}
            {(usage?.estimatedCny ?? 0).toFixed(2)} 元
          </span>
          <span className="health-chip">{health}</span>
          <span className="desk">{DESK_USER[role]}</span>
          <label className="role-label">
            工位{" "}
            <select
              value={role}
              onChange={(e) => setRolePersist(e.target.value as Role)}
            >
              <option value="sales">{ROLE_UI.sales}</option>
              <option value="manager">{ROLE_UI.manager}</option>
              <option value="viewer">{ROLE_UI.viewer}</option>
            </select>
          </label>
        </div>
      </header>
      {error ? <p className="flash flash-error">{error}</p> : null}
      {notice ? <p className="flash flash-ok">{notice}</p> : null}
      {busy ? <p className="flash flash-busy">{busy}</p> : null}

      {page === "list" && (
        <ListPage
          role={role}
          pendingIds={pendingIds}
          locked={locked}
          cardsStage={(l) => stageLabel(l, l.id === card?.lead.id ? card : null)}
          similarMsg={similarMsg}
          onOpen={openLead}
          onSimilar={(company) =>
            void run(
              async () => {
                const res = await getSimilar(role, company);
                const hit = res.hits[0];
                setSimilarMsg(
                  hit
                    ? `「${company}」对照结果：${hit.company}`
                    : `${company} 没有可对照的客户`,
                );
              },
              { busy: "正在对照相似客户" },
            )
          }
          onImportCsv={(csv) =>
            run(
              async () => {
                const res = await importLeadsCsv(role, csv);
                setNotice(
                  `导入 ${res.imported.length} 条，跳过 ${res.skipped.length} 条`,
                );
              },
              { busy: "正在导入 CSV" },
            )
          }
        />
      )}
      {page === "detail" && lead && (
        <DetailPage
          role={role}
          lead={lead}
          leads={leads}
          pendingIds={pendingIds}
          card={card?.lead.id === lead.id ? card : null}
          draft={draft}
          locked={locked}
          onPick={openLead}
          onDraft={setDraft}
          onStart={() =>
            void run(
              async () => {
                await ingestLead(role, lead.id, draft);
              },
              {
                busy: "正在按序交卷：系统分配 → 建档 → 转化，不会四路同时开工。",
                ok: "获客已提交，系统分配与建档会自动生效。",
              },
            )
          }
          onAbort={() =>
            setAsk({
              title: "中止后续",
              body: "只清空排队中的后续步骤，已经生效的交卷仍保留。",
              yes: "确定中止",
              danger: true,
              onYes: () =>
                void run(
                  async () => {
                    await abortLead(role, lead.id);
                  },
                  { busy: "正在中止后续", ok: "已中止后续" },
                ),
            })
          }
          onConfirm={(id) =>
            void run(
              async () => {
                await confirmHandoff(role, id);
              },
              { busy: "正在写入确认", ok: "已确认，库已更新" },
            )
          }
          onReject={(id) =>
            setAsk({
              title: "拒绝交卷",
              body: "拒绝后这条建议不再继续，历史交卷仍可在时间线查看。",
              yes: "确定拒绝",
              danger: true,
              onYes: () =>
                void run(
                  async () => {
                    await rejectHandoff(role, id);
                  },
                  { busy: "正在拒绝", ok: "已拒绝" },
                ),
            })
          }
          onAdvance={(stage) => {
            const go = () =>
              void run(
                async () => {
                  await advanceStage(role, lead.id, stage);
                },
                {
                  busy: "正在推进商机",
                  ok:
                    stage === "赢单" || stage === "丢单"
                      ? "已提交，待经理确认"
                      : `已推进到${stage}`,
                },
              );
            if (stage === "赢单" || stage === "丢单") {
              setAsk({
                title: stage === "赢单" ? "建议赢单" : "建议丢单",
                body: "销售只能提交建议。确认后由经理在待确认里批准。",
                yes: "提交建议",
                onYes: go,
              });
              return;
            }
            go();
          }}
        />
      )}
      {page === "pending" && (
        <PendingPage queue={queue} locked={locked} onOpen={openLead} />
      )}
      {page === "usage" && (
        <UsagePage usage={usage} byAgent={byAgent} leads={leads} />
      )}
      {page === "ingest" && (
        <IngestPage
          leads={leads}
          leadId={leadId}
          draft={draft}
          viewer={role === "viewer"}
          locked={locked}
          onLead={setLeadId}
          onDraft={setDraft}
          onSubmit={() =>
            void run(
              async () => {
                await ingestLead(role, leadId, draft);
                setPage("detail");
              },
              {
                busy: "正在按序交卷：系统分配 → 建档 → 转化，不会四路同时开工。",
                ok: "获客已提交，请在交卷时间线确认转化。",
              },
            )
          }
        />
      )}

      {ask ? (
        <div
          className="ask-mask"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ask-title"
        >
          <div className="ask">
            <h2 id="ask-title">{ask.title}</h2>
            <p>{ask.body}</p>
            <div className="row">
              <button type="button" className="ghost" onClick={() => setAsk(null)}>
                取消
              </button>
              <button
                type="button"
                className={ask.danger ? "danger" : "primary"}
                onClick={() => {
                  const next = ask.onYes;
                  setAsk(null);
                  next();
                }}
              >
                {ask.yes}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ListPage({
  role,
  pendingIds,
  locked,
  cardsStage,
  similarMsg,
  onOpen,
  onSimilar,
  onImportCsv,
}: {
  role: Role;
  pendingIds: Set<string>;
  locked: boolean;
  cardsStage: (l: Lead) => string;
  similarMsg: string;
  onOpen: (id: string) => void;
  onSimilar: (company: string) => void;
  onImportCsv: (csv: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<ListTab>("all");
  const [stage, setStage] = useState<OppStage | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [booting, setBooting] = useState(true);
  const canImport = role === "sales" || role === "manager";

  const fetchList = useCallback(async () => {
    setBooting(true);
    try {
      const res = await getLeads(role, leadsQueryForTab(tab, stage));
      setLeads(res.leads);
    } catch {
      setLeads([]);
    } finally {
      setBooting(false);
    }
  }, [role, tab, stage]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const csv = await file.text();
    await onImportCsv(csv);
    await fetchList();
  };

  const newCount = leads.filter((l) => l.status === "新线索").length;
  const waitCount = leads.filter((l) => pendingIds.has(l.id)).length;
  const rows = leads.filter((l) => {
    if (tab === "wait" && !pendingIds.has(l.id)) return false;
    const needle = q.trim();
    if (!needle) return true;
    return `${l.company}${l.industry}${l.contactName}`.includes(needle);
  });

  return (
    <div className="shell page">
      <header className="page-head">
        <h1 className="page-title">线索列表</h1>
        <p className="lede">
          共 {leads.length} 家 · 未转化 {newCount} · 待确认 {waitCount}
          。橙果素质教育仍是未转化线索，可走黄金切片。
        </p>
      </header>
      <div className="toolbar">
        <div className="filters" role="tablist" aria-label="客户筛选">
          {(
            [
              ["all", "全部"],
              ["new", "未转化"],
              ["open", "已转化"],
              ["wait", "待确认"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "filter on" : "filter"}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filters" role="group" aria-label="商机阶段">
          {STAGE_CHIPS.map((st) => (
            <button
              key={st}
              type="button"
              className={stage === st ? "filter on" : "filter"}
              aria-pressed={stage === st}
              onClick={() => setStage(stage === st ? null : st)}
            >
              {st}
            </button>
          ))}
        </div>
        <input
          className="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按公司或行业筛选"
          aria-label="按公司或行业筛选"
        />
        {canImport ? (
          <label className="import-csv">
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={locked}
              onChange={(e) => void handleImportFile(e)}
            />
            <span className="ghost">导入 CSV</span>
          </label>
        ) : null}
      </div>
      {similarMsg ? <p className="flash flash-busy">{similarMsg}</p> : null}
      {booting && leads.length === 0 ? (
        <p className="empty">正在载入客户。</p>
      ) : rows.length === 0 ? (
        <p className="empty">没有符合筛选的客户。清空筛选或改关键词。</p>
      ) : (
        <div className="table-wrap">
          <table className="work-table">
            <thead>
              <tr>
                <th>公司</th>
                <th>行业</th>
                <th>阶段</th>
                <th>负责人</th>
                <th>最近动作</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <button
                      type="button"
                      className="link-co"
                      onClick={() => onOpen(l.id)}
                    >
                      {l.company}
                    </button>
                    {pendingIds.has(l.id) ? (
                      <span className="pill pill-wait">待确认</span>
                    ) : null}
                  </td>
                  <td>{l.industry}</td>
                  <td>
                    <span className={l.status === "新线索" ? "pill" : "pill pill-on"}>
                      {cardsStage(l)}
                    </span>
                  </td>
                  <td>
                    {USER_LABEL[l.ownerUserId ?? ""] ?? l.ownerUserId ?? "未分配"}
                  </td>
                  <td className="muted">{l.lastActivity}</td>
                  <td>
                    <div className="wall-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={locked}
                        onClick={() => onOpen(l.id)}
                      >
                        看交卷
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={locked}
                        onClick={() => onSimilar(l.company)}
                      >
                        对照相似
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FunnelRail({ timeline }: { timeline: Handoff[] }) {
  return (
    <div className="rail" aria-label="漏斗四站">
      <div className="rail-groove" aria-hidden />
      {FUNNEL.map((s, i) => (
        <div
          key={s.agentId}
          className={`station ${stationClass(timeline, s.agentId)}`}
        >
          <span className="station-idx">{["壹", "贰", "叁", "肆"][i]}</span>
          <span className="station-post">
            <span className="station-dot" />
          </span>
          <div className="station-title">{s.title}</div>
          <div className="station-hint">{s.hint}</div>
        </div>
      ))}
    </div>
  );
}

function DetailPage({
  role,
  lead,
  leads,
  pendingIds,
  card,
  draft,
  locked,
  onPick,
  onDraft,
  onStart,
  onAbort,
  onConfirm,
  onReject,
  onAdvance,
}: {
  role: Role;
  lead: Lead;
  leads: Lead[];
  pendingIds: Set<string>;
  card: LeadCard | null;
  draft: string;
  locked: boolean;
  onPick: (id: string) => void;
  onDraft: (v: string) => void;
  onStart: () => void;
  onAbort: () => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onAdvance: (stage: OppStage) => void;
}) {
  const viewer = role === "viewer";
  const freeze = viewer || locked;
  const timeline = card?.timeline ?? [];
  const pendingHitl = timeline.find((h) => h.status === "待确认");
  const curStage = card?.opportunity?.stage ?? lead.oppStage ?? "";

  return (
    <div className="shell detail">
      <div className="rail-wrap">
        <FunnelRail timeline={timeline} />
      </div>
      <aside className="side">
        <p className="side-lead">在跟客户</p>
        {leads.map((l) => (
          <button
            key={l.id}
            type="button"
            className={l.id === lead.id ? "nameplate active" : "nameplate"}
            onClick={() => onPick(l.id)}
          >
            <div className="co">{l.company}</div>
            <div className="meta">
              <span className={l.status === "新线索" ? "pill" : "pill pill-on"}>
                {l.status === "新线索" ? "未转化" : l.oppStage ?? "已转化"}
              </span>
              {pendingIds.has(l.id) ? (
                <span className="pill pill-wait">待确认</span>
              ) : null}
            </div>
          </button>
        ))}
      </aside>
      <section className="well">
        <h2 className="timeline-head">
          交卷时间线（主）：系统分配 / 建档 / 商机 / 跟进
        </h2>
        {timeline.length === 0 ? (
          <p className="empty muted">
            这条线索还没有交卷。未转化线索请在右侧提交获客，系统分配和建档会自动生效。
          </p>
        ) : null}
        <div className="timeline">
          {timeline.map((h) => (
            <HandoffItem
              key={h.id}
              h={h}
              freeze={freeze}
              onConfirm={onConfirm}
              onReject={onReject}
            />
          ))}
        </div>
      </section>
      <section className="panel">
        <p className="kicker">客户档案</p>
        <h1>{lead.company}</h1>
        <p className="panel-sub">
          <span className="pill">线索 {lead.status}</span>
          <span>
            {USER_LABEL[lead.ownerUserId ?? ""] ?? lead.ownerUserId ?? "未分配"}
          </span>
        </p>
        <p className="summary">{lead.sourceSummary}</p>
        <p className="muted time">{lead.lastActivity}</p>
        {card?.account ? (
          <dl className="dossier">
            <div>
              <dt>客户</dt>
              <dd>{card.account.name}</dd>
            </div>
            <div>
              <dt>联系人</dt>
              <dd>
                {card.contact?.name}（{card.contact?.title}）
              </dd>
            </div>
            <div>
              <dt>商机</dt>
              <dd>
                {card.opportunity?.name} · {card.opportunity?.stage}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="muted">尚未转化，没有客户、联系人、商机。</p>
        )}
        {(card?.activities ?? []).length ? (
          <ul className="acts">
            {(card?.activities ?? []).map((a) => (
              <li key={a.id}>
                <span className="pill">{a.type}</span>
                {a.text}
                {a.effective ? "（已发出）" : "（草稿，待确认发出）"}
              </li>
            ))}
          </ul>
        ) : null}

        {lead.status === "新线索" ? (
          <div className="gate">
            <h2>录入获客（第二入口）</h2>
            <textarea
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              disabled={freeze}
            />
            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={onStart}
                disabled={freeze}
              >
                提交获客并分配
              </button>
              <button type="button" className="ghost" onClick={onAbort} disabled={freeze}>
                中止后续
              </button>
            </div>
          </div>
        ) : (
          <div className="gate">
            <h2>推进商机</h2>
            <p className="muted">需求确认、方案报价、谈判销售可直接推。赢单/丢单须经理确认。</p>
            <div className="row">
              {(["需求确认", "方案报价", "谈判"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={st === curStage ? "ghost current-stage" : "ghost"}
                  disabled={freeze || st === curStage}
                  onClick={() => onAdvance(st)}
                >
                  {st === curStage ? `当前：${st}` : `推进到${st}`}
                </button>
              ))}
              <button
                type="button"
                className={curStage === "赢单" ? "ghost current-stage" : "ghost"}
                disabled={freeze || curStage === "赢单" || curStage === "丢单"}
                onClick={() => onAdvance("赢单")}
              >
                建议赢单
              </button>
              <button
                type="button"
                className={curStage === "丢单" ? "ghost current-stage" : "ghost"}
                disabled={freeze || curStage === "赢单" || curStage === "丢单"}
                onClick={() => onAdvance("丢单")}
              >
                建议丢单
              </button>
              <button type="button" className="ghost" onClick={onAbort} disabled={freeze}>
                中止后续
              </button>
            </div>
          </div>
        )}
        {pendingHitl?.hitlKind === "confirm-convert" ? (
          <p className="flash flash-busy">
            商机已交出转化建议。确认转化后才会出现客户、联系人、商机（需求确认）。
          </p>
        ) : null}
        {pendingHitl?.hitlKind === "confirm-send" ? (
          <p className="flash flash-busy">
            跟进已交出电话草稿。确认发出后，活动才会生效。
          </p>
        ) : null}
        {pendingHitl && pendingHitl.hitlKind && !viewer ? (
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={locked}
              onClick={() => onConfirm(pendingHitl.id)}
            >
              {HITL_LABEL[pendingHitl.hitlKind] ?? "确认"}
            </button>
            <button
              type="button"
              className="danger"
              disabled={locked}
              onClick={() => onReject(pendingHitl.id)}
            >
              拒绝
            </button>
          </div>
        ) : null}
        {viewer ? <p className="muted">只读不能改库。改阶段会返回 403。</p> : null}
        {role === "sales" ? (
          <p className="muted">赢单/丢单请把角色切到经理再确认。</p>
        ) : null}
      </section>
    </div>
  );
}

function HandoffItem({
  h,
  freeze,
  onConfirm,
  onReject,
}: {
  h: Handoff;
  freeze: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const label = AGENT_LABEL[h.agentId as AgentId] ?? h.agentId;
  const waiting = h.status === "待确认";
  return (
    <article
      className={`ticket agent-${h.agentId}${waiting ? " wait" : ""}`}
    >
      {waiting ? (
        <span className="stamp" aria-label="待确认">
          待确认
        </span>
      ) : null}
      <div className="ticket-top">
        <strong>
          {label} · {h.status}
        </strong>
        <span className="ticket-tokens">
          {h.promptTokens + h.completionTokens} token
        </span>
      </div>
      <p>{h.summary}</p>
      {waiting && h.hitlKind && !freeze ? (
        <div className="row">
          <button type="button" className="primary" onClick={() => onConfirm(h.id)}>
            {HITL_LABEL[h.hitlKind] ?? "确认"}
          </button>
          <button type="button" className="danger" onClick={() => onReject(h.id)}>
            拒绝
          </button>
        </div>
      ) : null}
    </article>
  );
}

function PendingPage({
  queue,
  locked,
  onOpen,
}: {
  queue: PendingItem[];
  locked: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="shell page">
      <header className="page-head">
        <h1 className="page-title">待确认</h1>
        <p className="lede">只列出转化、外发、赢单/丢单。中间阶段不会出现在这里。</p>
      </header>
      {queue.length === 0 ? (
        <p className="empty">当前没有待确认项。</p>
      ) : (
        <div className="table-wrap">
          <table className="work-table">
            <thead>
              <tr>
                <th>状态</th>
                <th>公司</th>
                <th>闸门</th>
                <th>摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((h) => (
                <tr key={h.id}>
                  <td>
                    <span className="stamp stamp-inline" aria-label="待确认">
                      待确认
                    </span>
                  </td>
                  <td>
                    <strong className="co">{h.company}</strong>
                  </td>
                  <td>
                    {AGENT_LABEL[h.agentId] ?? h.agentId}
                    {" · "}
                    {h.hitlKind ? HITL_LABEL[h.hitlKind] ?? h.hitlKind : "无闸门"}
                  </td>
                  <td>{h.summary}</td>
                  <td>
                    <button
                      type="button"
                      className="primary"
                      disabled={locked}
                      onClick={() => onOpen(h.leadId)}
                    >
                      打开交卷时间线
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsagePage({
  usage,
  byAgent,
  leads,
}: {
  usage: Usage | null;
  byAgent: Record<string, number>;
  leads: Lead[];
}) {
  const agents: AgentId[] = [
    "orchestrator",
    "lead-intake",
    "pipeline",
    "followup",
  ];
  const nameOf = (id: string) =>
    leads.find((l) => l.id === id)?.company ?? id;
  const runs = [...(usage?.runs ?? [])].reverse().slice(0, 12);
  return (
    <div className="shell page">
      <header className="page-head">
        <h1 className="page-title">用量</h1>
        <p className="lede">交卷台账按四站合计，无充值、无图表。</p>
      </header>
      <article className="receipt">
        <p className="receipt-kicker">衡策销管</p>
        <h1>用量</h1>
        <p className="center">交卷台账 · 无充值</p>
        {agents.map((a) => (
          <div className="receipt-row" key={a}>
            <span>{AGENT_LABEL[a]}</span>
            <span>{byAgent[a] ?? 0}</span>
          </div>
        ))}
        <div className="receipt-row receipt-total">
          <span>合计</span>
          <span>
            {usage?.total ?? 0} token / {(usage?.estimatedCny ?? 0).toFixed(2)} 元
          </span>
        </div>
        <div className="receipt-row">
          <span>核对 runSum / ledgerSum</span>
          <span>
            {usage?.runSum ?? 0} / {usage?.ledgerSum ?? 0}
          </span>
        </div>
        {runs.length ? (
          <>
            <p className="center receipt-sub">最近分笔</p>
            {runs.map((r) => (
              <div className="receipt-row" key={r.id}>
                <span>
                  {AGENT_LABEL[r.agentId as AgentId] ?? r.agentId} · {nameOf(r.leadId)}
                </span>
                <span>{r.promptTokens + r.completionTokens}</span>
              </div>
            ))}
          </>
        ) : null}
      </article>
    </div>
  );
}

function IngestPage({
  leads,
  leadId,
  draft,
  viewer,
  locked,
  onLead,
  onDraft,
  onSubmit,
}: {
  leads: Lead[];
  leadId: string;
  draft: string;
  viewer: boolean;
  locked: boolean;
  onLead: (id: string) => void;
  onDraft: (v: string) => void;
  onSubmit: () => void;
}) {
  const freeze = viewer || locked;
  return (
    <div className="shell page">
      <section className="panel panel-narrow">
        <p className="kicker">获客</p>
        <h1>录入</h1>
        <p className="muted">
          主画面仍是交卷时间线。这里只提交获客文本，然后回到详情看系统分配 / 建档 /
          商机交卷。
        </p>
        <label className="field">
          <span>线索</span>
          <select
            value={leadId}
            onChange={(e) => onLead(e.target.value)}
            disabled={freeze}
          >
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.company}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>获客原文</span>
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            disabled={freeze}
          />
        </label>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={onSubmit}
            disabled={freeze || !draft.trim()}
          >
            提交获客并分配
          </button>
        </div>
      </section>
    </div>
  );
}
