import { describe, expect, it } from "vitest";
import { DEFAULT_QWEN_MODEL, qwenRunner } from "./qwen-runner";

describe("qwenRunner", () => {
  it("走百炼兼容接口，模型默认 qwen3.7-flash-2026-07-15，关闭思考", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const runner = qwenRunner({
      apiKey: "sk-test-not-real",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"summary":"系统分配给销售-陈。","ownerUserId":"user-sales-chen"}',
                },
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 8 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });
    const out = await runner.run({
      agentId: "orchestrator",
      prompt: "线索：橙果素质教育",
    });
    expect(out.ok).toBe(true);
    expect(out.promptTokens).toBe(12);
    expect(out.completionTokens).toBe(8);
    expect(out.text).toMatch(/ownerUserId/);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-test-not-real");
    const body = JSON.parse(String(calls[0]?.init.body)) as {
      model: string;
      enable_thinking: boolean;
      messages: { role: string }[];
    };
    expect(body.model).toBe(DEFAULT_QWEN_MODEL);
    expect(body.enable_thinking).toBe(false);
    expect(body.messages.map((m) => m.role)).toEqual(["system", "user"]);
  });

  it("HTTP 失败记 ok=false，响应里不回密钥", async () => {
    const runner = qwenRunner({
      apiKey: "sk-secret-value",
      fetchImpl: async () =>
        new Response("unauthorized", { status: 401 }),
    });
    const out = await runner.run({
      agentId: "orchestrator",
      prompt: "x",
    });
    expect(out.ok).toBe(false);
    expect(out.text).toBe("qwen-http-401");
    expect(out.text).not.toMatch(/sk-secret/);
  });
});
