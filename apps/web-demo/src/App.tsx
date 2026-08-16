import { useEffect, useMemo, useState } from "react";
import {
  leadHandoffs,
  pendingArrivalKey,
  pendingHandoffs,
  reduce,
  tokenSum,
} from "./mock/machine";
import { createInitialState, SIMILAR_HINTS } from "./mock/seed";
import { AGENT_LABEL } from "./mock/types";
import type {
  AgentId,
  DemoState,
  Handoff,
  HitlKind,
  OppStage,
  Role,
} from "./mock/types";

const DELAY_MS = 800;

type Page = "list" | "detail" | "pending" | "usage";

const HITL_LABEL: Record<HitlKind, string> = {
  "confirm-convert": "确认转化",
  "confirm-send": "确认发出",
  "confirm-win-loss": "主管确认赢单/丢单",
};

const WAITING_HINT: Record<AgentId, string> = {
  orchestrator: "系统分配生成中（约 0.8 秒，自动生效）…",
  "lead-intake": "建档生成中（约 0.8 秒，自动生效，无需确认新建）…",
  pipeline:
    "商机转化建议生成中（约 0.8 秒）。出现后请在右侧点「确认转化」；转化前左侧不会出现三张对象。",
  followup:
    "跟进草稿生成中（约 0.8 秒）。出现后请在右侧点「确认发出」，才会有电话活动。",
};

function stageLabel(state: DemoState, leadId: string): string {
  const lead = state.leads.find((l) => l.id === leadId);
  const opp = state.opportunities.find((o) => o.leadId === leadId);
  if (opp) return `商机·${opp.stage}`;
  return `线索·${lead?.status ?? ""}`;
}

export function App() {
  const [state, setState] = useState<DemoState>(createInitialState);
  const [page, setPage] = useState<Page>("list");
  const [leadId, setLeadId] = useState("lead-chengguo");
  const [draft, setDraft] = useState("林校长想给三个校区上销售跟进台账");
  const [similarMsg, setSimilarMsg] = useState("");

  const dispatch = (event: Parameters<typeof reduce>[1]) => {
    setState((s) => reduce(s, event));
  };

  const pendingKey = pendingArrivalKey(state.pendingArrival);
  useEffect(() => {
    if (pendingKey === "") return;
    const ids = pendingKey.split(",").map((row) => row.split(":")[0]!);
    const timers = ids.map((id) =>
      window.setTimeout(() => {
        setState((s) => {
          if (!s.pendingArrival[id]) return s;
          return reduce(s, { type: "arrive", leadId: id });
        });
      }, DELAY_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [pendingKey]);

  const lead = state.leads.find((l) => l.id === leadId) ?? state.leads[0]!;
  const timeline = leadHandoffs(state, lead.id);
  const usage = useMemo(() => tokenSum(state.handoffs), [state.handoffs]);
  const queue = pendingHandoffs(state);

  const openLead = (id: string) => {
    setLeadId(id);
    setPage("detail");
  };

  return (
    <>
      <header className="top">
        <strong>衡策销管平台 · 点击原型（无后端）</strong>
        <nav>
          <button type="button" onClick={() => setPage("list")}>
            线索列表
          </button>
          <button type="button" onClick={() => setPage("detail")}>
            线索详情
          </button>
          <button type="button" onClick={() => setPage("pending")}>
            待确认（{queue.length}）
          </button>
          <button type="button" onClick={() => setPage("usage")}>
            用量
          </button>
        </nav>
        <div className="top-right">
          <span>
            Token 合计 {usage.total}（约 {usage.cny.toFixed(2)} 元）
          </span>
          <label>
            角色{" "}
            <select
              value={state.role}
              onChange={(e) =>
                dispatch({ type: "set-role", role: e.target.value as Role })
              }
            >
              <option value="sales">sales</option>
              <option value="manager">manager</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
        </div>
      </header>

      {page === "list" && (
        <ListPage
          state={state}
          activeId={lead.id}
          similarMsg={similarMsg}
          onOpen={openLead}
          onSimilar={(company) => {
            const hit = SIMILAR_HINTS[company];
            setSimilarMsg(
              hit
                ? `写死提示：和「${company}」很像 → ${hit}`
                : `写死提示：${company} 无相似对（刻意不像或未配置）`,
            );
          }}
        />
      )}
      {page === "detail" && (
        <DetailPage
          state={state}
          lead={lead}
          timeline={timeline}
          draft={draft}
          onDraft={setDraft}
          onStart={() =>
            dispatch({ type: "start-slice", leadId: lead.id, text: draft })
          }
          onAbort={() => dispatch({ type: "abort", leadId: lead.id })}
          onConfirm={(id) => dispatch({ type: "confirm", handoffId: id })}
          onReject={(id) => dispatch({ type: "reject", handoffId: id })}
          onAdvance={(stage) =>
            dispatch({ type: "advance-stage", leadId: lead.id, stage })
          }
        />
      )}
      {page === "pending" && (
        <PendingPage queue={queue} leads={state.leads} onOpen={openLead} />
      )}
      {page === "usage" && <UsagePage usage={usage} />}
    </>
  );
}

function ListPage({
  state,
  activeId,
  similarMsg,
  onOpen,
  onSimilar,
}: {
  state: DemoState;
  activeId: string;
  similarMsg: string;
  onOpen: (id: string) => void;
  onSimilar: (company: string) => void;
}) {
  return (
    <div className="layout">
      <aside className="side">
        <p>点公司名进入详情时间线。橙果未转化，可跑黄金切片。</p>
        {state.leads.map((l) => (
          <button
            key={l.id}
            type="button"
            className={l.id === activeId ? "lead-btn active" : "lead-btn"}
            onClick={() => onOpen(l.id)}
          >
            <div>{l.company}</div>
            <div className="muted">
              {l.industry} · {stageLabel(state, l.id)}
            </div>
          </button>
        ))}
      </aside>
      <section className="main">
        <h1>线索列表</h1>
        <table>
          <thead>
            <tr>
              <th>公司</th>
              <th>行业</th>
              <th>对象状态</th>
              <th>所有人</th>
              <th>最后活动</th>
              <th>相似</th>
            </tr>
          </thead>
          <tbody>
            {state.leads.map((l) => (
              <tr key={l.id}>
                <td>
                  <button type="button" onClick={() => onOpen(l.id)}>
                    {l.company}
                  </button>
                </td>
                <td>{l.industry}</td>
                <td>{stageLabel(state, l.id)}</td>
                <td>{l.owner}</td>
                <td>{l.lastActivity}</td>
                <td>
                  <button type="button" onClick={() => onSimilar(l.company)}>
                    找很像的
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {similarMsg ? <p className="banner">{similarMsg}</p> : null}
      </section>
    </div>
  );
}

function DetailPage({
  state,
  lead,
  timeline,
  draft,
  onDraft,
  onStart,
  onAbort,
  onConfirm,
  onReject,
  onAdvance,
}: {
  state: DemoState;
  lead: DemoState["leads"][number];
  timeline: Handoff[];
  draft: string;
  onDraft: (v: string) => void;
  onStart: () => void;
  onAbort: () => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onAdvance: (stage: OppStage) => void;
}) {
  const waitingAgent = state.pendingArrival[lead.id];
  const waiting = Boolean(waitingAgent);
  const viewer = state.role === "viewer";
  const account = state.accounts.find((a) => a.leadId === lead.id);
  const contact = state.contacts.find((c) => c.accountId === account?.id);
  const opp = state.opportunities.find((o) => o.leadId === lead.id);
  const acts = state.activities.filter((a) => a.opportunityId === opp?.id);
  const pendingHitl = timeline.find((h) => h.status === "待确认");

  return (
    <div className="split" style={{ padding: 12 }}>
      <section className="card">
        <h1>{lead.company}</h1>
        <p>线索状态：{lead.status} · 所有人：{lead.owner}</p>
        <p>来源摘要：{lead.sourceSummary}</p>
        <p>最后活动：{lead.lastActivity}</p>
        {account ? (
          <>
            <p>客户：{account.name}</p>
            <p>联系人：{contact?.name}（{contact?.title}）</p>
            <p>商机：{opp?.name} · {opp?.stage}</p>
          </>
        ) : (
          <p className="muted">尚未转化，没有客户/联系人/商机三张对象。</p>
        )}
        {acts.map((a) => (
          <p key={a.id}>
            活动[{a.type}] {a.text}
            {a.effective ? "（已生效）" : ""}
          </p>
        ))}

        {lead.status === "新线索" ? (
          <>
            <h2>录入并跑切片（第二入口）</h2>
            <textarea
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              disabled={viewer}
            />
            <div className="row">
              <button type="button" onClick={onStart} disabled={viewer || waiting}>
                提交获客并分配
              </button>
              <button type="button" onClick={onAbort} disabled={viewer}>
                中止后续
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>销售推进商机（低风险直接改；赢单/丢单走主管闸门）</h2>
            <div className="row">
              {(
                ["需求确认", "方案报价", "谈判"] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={viewer}
                  onClick={() => onAdvance(st)}
                >
                  推进到{st}
                </button>
              ))}
              <button
                type="button"
                disabled={viewer}
                onClick={() => onAdvance("赢单")}
              >
                建议赢单
              </button>
              <button
                type="button"
                disabled={viewer}
                onClick={() => onAdvance("丢单")}
              >
                建议丢单
              </button>
              <button type="button" onClick={onAbort} disabled={viewer}>
                中止后续
              </button>
            </div>
          </>
        )}
        {waiting && waitingAgent ? (
          <p className="banner">{WAITING_HINT[waitingAgent]}</p>
        ) : null}
        {pendingHitl?.hitlKind === "confirm-convert" ? (
          <p className="banner">
            商机已交出转化建议。点「确认转化」后，左侧才会出现客户 / 联系人 /
            商机（需求确认）。
          </p>
        ) : null}
        {pendingHitl?.hitlKind === "confirm-send" ? (
          <p className="banner">
            跟进已交出电话草稿。点「确认发出」后，左侧才会出现类型为电话的活动。
          </p>
        ) : null}
        {pendingHitl && pendingHitl.hitlKind && !viewer ? (
          <div className="row">
            <button
              type="button"
              onClick={() => onConfirm(pendingHitl.id)}
            >
              {HITL_LABEL[pendingHitl.hitlKind]}
            </button>
            <button type="button" onClick={() => onReject(pendingHitl.id)}>
              拒绝
            </button>
          </div>
        ) : null}
        {viewer ? <p className="muted">viewer 只读。</p> : null}
        {state.role === "sales" ? (
          <p className="muted">赢单/丢单请切 manager 才能确认。</p>
        ) : null}
      </section>
      <section>
        <h2>handoff 时间线（主）：系统分配 / 建档 / 商机 / 跟进</h2>
        {timeline.length === 0 ? (
          <p className="muted">时间线为空。未转化线索请提交获客。</p>
        ) : null}
        {timeline.map((h) => (
          <article
            key={h.id}
            className={h.status === "待确认" ? "item pending" : "item"}
          >
            <div>
              <strong>{AGENT_LABEL[h.agent]}</strong>
              <span className="muted">（{h.agent}）</span> · {h.status} · token{" "}
              {h.promptTokens + h.completionTokens}
            </div>
            <p>{h.summary}</p>
            {h.status === "待确认" && h.hitlKind && !viewer ? (
              <div className="row">
                <button type="button" onClick={() => onConfirm(h.id)}>
                  {HITL_LABEL[h.hitlKind]}
                </button>
                <button type="button" onClick={() => onReject(h.id)}>
                  拒绝
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}

function PendingPage({
  queue,
  leads,
  onOpen,
}: {
  queue: Handoff[];
  leads: DemoState["leads"];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="main">
      <h1>待确认队列</h1>
      {queue.length === 0 ? <p>当前没有待确认项。</p> : null}
      {queue.map((h) => {
        const company =
          leads.find((l) => l.id === h.leadId)?.company ?? h.leadId;
        return (
          <article key={h.id} className="item">
            <div>
              {company} · {AGENT_LABEL[h.agent]} · {h.hitlKind ?? "无闸门"}
            </div>
            <p>{h.summary}</p>
            <button type="button" onClick={() => onOpen(h.leadId)}>
              打开详情时间线
            </button>
          </article>
        );
      })}
    </section>
  );
}

function UsagePage({ usage }: { usage: ReturnType<typeof tokenSum> }) {
  return (
    <section className="main">
      <h1>用量（本会话假数据）</h1>
      <p>无充值、无套餐。合计必须等于各角色之和。</p>
      <table>
        <thead>
          <tr>
            <th>角色</th>
            <th>token</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              "orchestrator",
              "lead-intake",
              "pipeline",
              "followup",
            ] as const
          ).map((a) => (
            <tr key={a}>
              <td>
                {AGENT_LABEL[a]} / {a}
              </td>
              <td>{usage.byAgent[a]}</td>
            </tr>
          ))}
          <tr>
            <td>合计</td>
            <td>
              {usage.total} / 约 {usage.cny.toFixed(2)} 元
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
