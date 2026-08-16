import { cursorSdkRunner } from "./cursor-runner";
import {
  DEFAULT_QWEN_BASE_URL,
  DEFAULT_QWEN_MODEL,
  qwenRunner,
} from "./qwen-runner";
import type { AgentRunner } from "./runner";
import { scriptedRunner } from "./scripted-runner";

export type RunnerKind = "scripted" | "cursor" | "qwen";

export function hasLiveModelKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.DASHSCOPE_API_KEY?.trim() || env.CURSOR_API_KEY?.trim(),
  );
}

/**
 * 无密钥默认 scripted，保证 ACL/顺序测试可跑。
 * 有 DASHSCOPE_API_KEY 且未强制 scripted 时走千问。
 * 仅有 CURSOR_API_KEY 时仍走 Cursor SDK。
 * 密钥只留在本进程，禁止传给 web。
 */
export function selectRunner(
  env: NodeJS.ProcessEnv = process.env,
): { kind: RunnerKind; runner: AgentRunner } {
  const mode = env.HENGCE_RUNNER?.trim();
  const dashscope = env.DASHSCOPE_API_KEY?.trim();
  const cursor = env.CURSOR_API_KEY?.trim();
  if (mode === "scripted") {
    return { kind: "scripted", runner: scriptedRunner() };
  }
  if (mode === "qwen") {
    if (!dashscope) {
      throw new Error("HENGCE_RUNNER=qwen 需要 DASHSCOPE_API_KEY");
    }
    return {
      kind: "qwen",
      runner: qwenRunner({
        apiKey: dashscope,
        model: env.HENGCE_QWEN_MODEL,
        baseUrl: env.HENGCE_QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL,
      }),
    };
  }
  if (mode === "cursor") {
    if (!cursor) {
      throw new Error("HENGCE_RUNNER=cursor 需要 CURSOR_API_KEY");
    }
    return { kind: "cursor", runner: cursorSdkRunner(cursor) };
  }
  if (dashscope) {
    return {
      kind: "qwen",
      runner: qwenRunner({
        apiKey: dashscope,
        model: env.HENGCE_QWEN_MODEL || DEFAULT_QWEN_MODEL,
        baseUrl: env.HENGCE_QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL,
      }),
    };
  }
  if (cursor) {
    return { kind: "cursor", runner: cursorSdkRunner(cursor) };
  }
  return { kind: "scripted", runner: scriptedRunner() };
}
