import type { Lead, LeadCard, OppStage, PendingItem, Role, Usage } from "./types";

const ROLE_KEY = "hengce-role";

export function readRole(): Role {
  try {
    const v = localStorage.getItem(ROLE_KEY);
    if (v === "manager" || v === "viewer" || v === "sales") return v;
  } catch {
    /* 测试环境可能无 localStorage */
  }
  return "sales";
}

export function writeRole(role: Role): void {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  role: Role,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-hengce-role": role,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(res.status, text || "非 JSON 响应");
  }
  if (!res.ok) {
    const err = (data as { error?: string } | null)?.error ?? res.statusText;
    throw new ApiError(res.status, err);
  }
  return data as T;
}

export function getHealth(role: Role) {
  return request<{ ok: boolean; service: string; runner?: string }>(
    "/api/health",
    role,
  );
}

export function getLeads(role: Role) {
  return request<{ leads: Lead[] }>("/api/leads", role);
}

export function getLead(role: Role, id: string) {
  return request<LeadCard>(`/api/leads/${encodeURIComponent(id)}`, role);
}

export function ingestLead(role: Role, leadId: string, text: string) {
  return request<{ ok: boolean; leadId: string; card: LeadCard }>(
    "/api/leads/ingest",
    role,
    { method: "POST", body: JSON.stringify({ leadId, text }) },
  );
}

export function confirmHandoff(role: Role, id: string) {
  return request<{ ok: boolean }>(
    `/api/handoffs/${encodeURIComponent(id)}/confirm`,
    role,
    { method: "POST", body: "{}" },
  );
}

export function rejectHandoff(role: Role, id: string) {
  return request<{ ok: boolean }>(
    `/api/handoffs/${encodeURIComponent(id)}/reject`,
    role,
    { method: "POST", body: "{}" },
  );
}

export function abortLead(role: Role, leadId: string) {
  return request<{ ok: boolean }>(
    `/api/leads/${encodeURIComponent(leadId)}/abort`,
    role,
    { method: "POST", body: "{}" },
  );
}

export function advanceStage(role: Role, leadId: string, stage: OppStage) {
  return request<{ ok: boolean; card: LeadCard }>(
    `/api/leads/${encodeURIComponent(leadId)}/stage`,
    role,
    { method: "POST", body: JSON.stringify({ stage }) },
  );
}

export function getUsage(role: Role) {
  return request<Usage>("/api/usage", role);
}

export function getPending(role: Role) {
  return request<{ items: PendingItem[] }>("/api/handoffs/pending", role);
}

export function getSimilar(role: Role, company: string) {
  return request<{ hits: { company: string; score: number }[] }>(
    `/api/similar?company=${encodeURIComponent(company)}`,
    role,
  );
}
