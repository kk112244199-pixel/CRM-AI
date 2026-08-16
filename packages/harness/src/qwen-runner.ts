import type { AgentId } from "@hengce/domain";
import { buildAgentMessages } from "./agent-prompt";
import type { AgentRunner } from "./runner";

export const DEFAULT_QWEN_MODEL = "qwen3.7-flash-2026-07-15";
export const DEFAULT_QWEN_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

export type QwenRunnerOpts = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function chatCompletionsUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

function messageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("")
    .trim();
}

/**
 * 阿里云百炼 OpenAI 兼容 Chat Completions。
 * 密钥只留在本进程；关闭思考模式，避免推理文本污染 JSON。
 */
export function qwenRunner(opts: QwenRunnerOpts): AgentRunner {
  const model = opts.model?.trim() || DEFAULT_QWEN_MODEL;
  const url = chatCompletionsUrl(opts.baseUrl?.trim() || DEFAULT_QWEN_BASE_URL);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 60_000;

  return {
    async run({ agentId, prompt }) {
      const id = agentId as AgentId;
      const { system, user } = buildAgentMessages(id, prompt);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            "content-type": "application/json",
          },
          signal: ac.signal,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            enable_thinking: false,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });
        const raw = await res.text();
        if (!res.ok) {
          return {
            text: `qwen-http-${res.status}`,
            promptTokens: 0,
            completionTokens: 0,
            ok: false,
          };
        }
        let parsed: {
          choices?: { message?: { content?: unknown } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          return {
            text: "qwen-bad-json",
            promptTokens: 0,
            completionTokens: 0,
            ok: false,
          };
        }
        const text = messageContent(parsed.choices?.[0]?.message?.content);
        if (!text) {
          return {
            text: "qwen-empty",
            promptTokens: 0,
            completionTokens: 0,
            ok: false,
          };
        }
        const promptTokens =
          parsed.usage?.prompt_tokens ?? Math.ceil((system.length + user.length) / 4);
        const completionTokens =
          parsed.usage?.completion_tokens ?? Math.ceil(text.length / 4);
        return { text, promptTokens, completionTokens, ok: true };
      } catch (err) {
        const aborted =
          err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
        return {
          text: aborted ? "qwen-timeout" : "qwen-network",
          promptTokens: 0,
          completionTokens: 0,
          ok: false,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
