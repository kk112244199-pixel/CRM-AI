import { Agent, CursorAgentError } from "@cursor/sdk";
import { repoRoot, type AgentId } from "@hengce/domain";
import { buildAgentMessages } from "./agent-prompt";
import type { AgentRunner } from "./runner";

/**
 * 本地 Cursor Agent。显式 local.cwd；tools 空列表只许回文本，避免改仓库。
 * 禁止 cloud.repos。用完必须 dispose。
 */
export function cursorSdkRunner(apiKey: string): AgentRunner {
  const cwd = repoRoot();
  return {
    async run({ agentId, prompt }) {
      const id = agentId as AgentId;
      const { system, user } = buildAgentMessages(id, prompt);
      let agent: Awaited<ReturnType<typeof Agent.create>> | undefined;
      try {
        agent = await Agent.create({
          apiKey,
          model: { id: "composer-2.5" },
          tools: [],
          local: { cwd, settingSources: [] },
        });
        const run = await agent.send([system, "", user].join("\n"));
        const result = await run.wait();
        const usage = result.usage;
        const text = result.result?.trim() ?? "";
        const promptTokens = usage?.inputTokens ?? Math.ceil(prompt.length / 4);
        const completionTokens =
          usage?.outputTokens ?? Math.ceil(text.length / 4);
        return {
          text,
          promptTokens,
          completionTokens,
          ok: result.status === "finished",
        };
      } catch (err) {
        if (err instanceof CursorAgentError) {
          return {
            text: err.message,
            promptTokens: 0,
            completionTokens: 0,
            ok: false,
          };
        }
        throw err;
      } finally {
        if (agent) await agent[Symbol.asyncDispose]();
      }
    },
  };
}
