import type { IncomingHttpHeaders } from "node:http";
import {
  abortLead,
  abortRun,
  advanceStage,
  confirmHandoff,
  getLeadCard,
  importLeadsFromCsv,
  ingestLead,
  isHarnessError,
  listLeadRows,
  listPending,
  rejectHandoff,
  searchSimilar,
  usageBreakdown,
  type HarnessCtx,
  type RunnerKind,
} from "@hengce/harness";
import {
  LEAD_STATUSES,
  OPP_STAGES,
  type LeadStatus,
  type OppStage,
  type UserRole,
} from "@hengce/domain";
import { handleHealth } from "./health";

export type ApiCtx = HarnessCtx & { runnerKind: RunnerKind };

export type HttpResult = {
  status: number;
  body: string;
  contentType?: string;
  extraHeaders?: Record<string, string>;
};

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-hengce-role",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

function json(status: number, data: unknown): HttpResult {
  return {
    status,
    body: JSON.stringify(data),
    contentType: "application/json; charset=utf-8",
    extraHeaders: CORS,
  };
}

function roleOf(headers: IncomingHttpHeaders): UserRole {
  const raw = headers["x-hengce-role"];
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (v === "manager" || v === "viewer" || v === "sales") return v;
  return "sales";
}

function readJson(body: string | undefined): Record<string, unknown> {
  if (!body?.trim()) return {};
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not-object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    const err = new Error("请求体不是合法 JSON");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
}

/**
 * HTTP 入口。ingest 只启动顺序切片，语义不是四个 Agent 同时开工。
 * 不把 DASHSCOPE_API_KEY / CURSOR_API_KEY 写入任何响应。不暴露 Agent 端口。
 */
export async function handleApi(
  ctx: ApiCtx,
  req: {
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
    body?: string;
  },
): Promise<HttpResult> {
  const method = (req.method ?? "GET").toUpperCase();
  const parsedUrl = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = parsedUrl.pathname;
  try {
    if (method === "OPTIONS") {
      return { status: 204, body: "", extraHeaders: CORS };
    }

    if (method === "GET" && (path === "/api/health" || path === "/health")) {
      const h = handleHealth(path);
      const parsed = JSON.parse(h.body) as Record<string, unknown>;
      return json(h.status, { ...parsed, runner: ctx.runnerKind });
    }

    if (method === "GET" && path === "/api/metrics") {
      const u = usageBreakdown(ctx.sqlite);
      return {
        status: 200,
        contentType: "text/plain; version=0.0.4; charset=utf-8",
        extraHeaders: CORS,
        body: [
          "# TYPE hengce_up gauge",
          "hengce_up 1",
          "# TYPE hengce_token_total counter",
          `hengce_token_total ${u.total}`,
          "",
        ].join("\n"),
      };
    }

    if (method === "GET" && path === "/api/usage") {
      const u = usageBreakdown(ctx.sqlite);
      return json(200, {
        total: u.total,
        estimatedCny: u.cny,
        runSum: u.runSum,
        ledgerSum: u.ledgerSum,
        runs: u.runs,
      });
    }

    if (method === "GET" && path === "/api/similar") {
      const company = parsedUrl.searchParams.get("company") ?? "";
      return json(200, { hits: searchSimilar(ctx.sqlite, company) });
    }

    if (method === "GET" && path === "/api/handoffs/pending") {
      return json(200, { items: listPending(ctx.sqlite) });
    }

    if (method === "GET" && path === "/api/leads") {
      const statusParam = parsedUrl.searchParams.get("status");
      const stageParam = parsedUrl.searchParams.get("stage");
      const filters: { status?: LeadStatus; stage?: OppStage } = {};
      if (statusParam !== null && statusParam !== "") {
        if (!LEAD_STATUSES.includes(statusParam as LeadStatus)) {
          return json(400, { ok: false, error: "非法 status" });
        }
        filters.status = statusParam as LeadStatus;
      }
      if (stageParam !== null && stageParam !== "") {
        if (!OPP_STAGES.includes(stageParam as OppStage)) {
          return json(400, { ok: false, error: "非法 stage" });
        }
        filters.stage = stageParam as OppStage;
      }
      const hasFilter = filters.status !== undefined || filters.stage !== undefined;
      return json(200, {
        leads: listLeadRows(ctx.db, hasFilter ? filters : undefined),
      });
    }

    if (method === "POST" && path === "/api/leads/import") {
      const role = roleOf(req.headers);
      const body = readJson(req.body);
      const csv = typeof body.csv === "string" ? body.csv : "";
      if (!csv.trim()) {
        return json(400, { ok: false, error: "需要 csv" });
      }
      const result = importLeadsFromCsv(ctx, { csv, role });
      return json(200, result);
    }

    const leadGet = path.match(/^\/api\/leads\/([^/]+)$/);
    if (method === "GET" && leadGet) {
      const card = getLeadCard(ctx.db, decodeURIComponent(leadGet[1] ?? ""));
      if (!card) return json(404, { ok: false, error: "线索不存在" });
      return json(200, card);
    }

    const role = roleOf(req.headers);

    if (method === "POST" && path === "/api/leads/ingest") {
      const body = readJson(req.body);
      const text = typeof body.text === "string" ? body.text : "";
      const leadId =
        typeof body.leadId === "string" && body.leadId.trim()
          ? body.leadId.trim()
          : "lead-chengguo";
      if (!text.trim()) {
        return json(400, { ok: false, error: "需要 text" });
      }
      const result = await ingestLead(ctx, { leadId, text, role });
      const card = getLeadCard(ctx.db, result.leadId);
      return json(200, { ok: true, leadId: result.leadId, card });
    }

    const stage = path.match(/^\/api\/leads\/([^/]+)\/stage$/);
    if (method === "POST" && stage) {
      const body = readJson(req.body);
      const st = typeof body.stage === "string" ? body.stage : "";
      if (!OPP_STAGES.includes(st as OppStage)) {
        return json(400, { ok: false, error: "非法阶段" });
      }
      advanceStage(ctx, {
        leadId: decodeURIComponent(stage[1] ?? ""),
        stage: st as OppStage,
        role,
      });
      const card = getLeadCard(ctx.db, decodeURIComponent(stage[1] ?? ""));
      return json(200, { ok: true, card });
    }

    const abortLeadPath = path.match(/^\/api\/leads\/([^/]+)\/abort$/);
    if (method === "POST" && abortLeadPath) {
      abortLead(ctx, {
        leadId: decodeURIComponent(abortLeadPath[1] ?? ""),
        role,
      });
      return json(200, { ok: true });
    }

    const confirm = path.match(/^\/api\/handoffs\/([^/]+)\/confirm$/);
    if (method === "POST" && confirm) {
      await confirmHandoff(ctx, {
        handoffId: decodeURIComponent(confirm[1] ?? ""),
        role,
      });
      return json(200, { ok: true });
    }

    const reject = path.match(/^\/api\/handoffs\/([^/]+)\/reject$/);
    if (method === "POST" && reject) {
      rejectHandoff(ctx, {
        handoffId: decodeURIComponent(reject[1] ?? ""),
        role,
      });
      return json(200, { ok: true });
    }

    const abort = path.match(/^\/api\/runs\/([^/]+)\/abort$/);
    if (method === "POST" && abort) {
      abortRun(ctx, {
        runId: decodeURIComponent(abort[1] ?? ""),
        role,
      });
      return json(200, { ok: true });
    }

    return json(404, { ok: false, error: "not found" });
  } catch (err) {
    if (isHarnessError(err)) {
      return json(err.status, { ok: false, error: err.message });
    }
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "internal";
    return json(status, { ok: false, error: message });
  }
}
