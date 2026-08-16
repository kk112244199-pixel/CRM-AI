import { loadRootEnv } from "../packages/harness/src/load-env";
import {
  DEFAULT_QWEN_BASE_URL,
  DEFAULT_QWEN_MODEL,
} from "../packages/harness/src/qwen-runner";

loadRootEnv();

const key = process.env.DASHSCOPE_API_KEY?.trim() ?? "";
if (!key) {
  console.error("DASHSCOPE_API_KEY missing");
  process.exit(1);
}

const base = (process.env.HENGCE_QWEN_BASE_URL?.trim() || DEFAULT_QWEN_BASE_URL).replace(
  /\/+$/,
  "",
);
const model = process.env.HENGCE_QWEN_MODEL?.trim() || DEFAULT_QWEN_MODEL;
const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 45_000);

try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    signal: ac.signal,
    body: JSON.stringify({
      model,
      temperature: 0,
      enable_thinking: false,
      messages: [{ role: "user", content: "只回复一个汉字：好" }],
    }),
  });
  const raw = await res.text();
  const redacted = raw.replace(/sk-[A-Za-z0-9]+/g, "sk-***");
  let content = "";
  try {
    const parsed = JSON.parse(raw) as {
      choices?: { message?: { content?: unknown } }[];
      error?: { message?: string; code?: string };
    };
    const c = parsed.choices?.[0]?.message?.content;
    content = typeof c === "string" ? c : JSON.stringify(c ?? "");
    if (!res.ok) {
      console.log(
        JSON.stringify({
          http: res.status,
          model,
          error: parsed.error ?? redacted.slice(0, 300),
        }),
      );
      process.exit(1);
    }
  } catch {
    console.log(JSON.stringify({ http: res.status, model, body: redacted.slice(0, 300) }));
    process.exit(res.ok ? 0 : 1);
  }
  console.log(JSON.stringify({ http: res.status, model, content: content.slice(0, 80) }));
  if (!res.ok) process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? `${err.name}:${err.message}` : "err";
  console.error(msg.replace(/sk-[A-Za-z0-9]+/g, "sk-***"));
  process.exit(1);
} finally {
  clearTimeout(timer);
}
