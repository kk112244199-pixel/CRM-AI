import { describe, expect, it } from "vitest";
import { agentRuns, bootstrapMemoryDb, closeDb } from "@hengce/domain";
import { ingestLead, leadTimeline, type HarnessCtx } from "./scheduler";
import { scriptedRunner } from "./scripted-runner";
import type { AgentRunner } from "./runner";

const CHENGGUO = "lead-chengguo";

describe("R1 崩溃后续跑", () => {
  it("pipeline 前杀掉后，已落库 handoff 不丢，run_id 不重复，从建档之后续跑", async () => {
    const opened = bootstrapMemoryDb();
    const inner = scriptedRunner();
    let pipelineHits = 0;
    const runner: AgentRunner = {
      async run(input) {
        if (input.agentId === "pipeline") {
          pipelineHits += 1;
          if (pipelineHits === 1) {
            throw new Error("killed-before-pipeline");
          }
        }
        return inner.run(input);
      },
    };
    const ctx: HarnessCtx = {
      db: opened.db,
      sqlite: opened.sqlite,
      runner,
    };
    await expect(
      ingestLead(ctx, { leadId: CHENGGUO, text: "x", role: "sales" }),
    ).rejects.toThrow(/killed-before-pipeline/);

    const afterKill = leadTimeline(ctx.db, CHENGGUO);
    expect(afterKill.map((h) => h.agentId)).toEqual([
      "orchestrator",
      "lead-intake",
    ]);
    expect(afterKill.every((h) => h.status === "已生效")).toBe(true);
    const runIds = opened.db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .all()
      .map((r) => r.id);
    expect(new Set(runIds).size).toBe(runIds.length);

    await ingestLead(ctx, { leadId: CHENGGUO, text: "x", role: "sales" });
    const resumed = leadTimeline(ctx.db, CHENGGUO);
    expect(resumed.map((h) => h.agentId)).toEqual([
      "orchestrator",
      "lead-intake",
      "pipeline",
    ]);
    expect(resumed.filter((h) => h.agentId === "orchestrator")).toHaveLength(1);
    expect(resumed.filter((h) => h.agentId === "lead-intake")).toHaveLength(1);
    const runIds2 = opened.db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .all()
      .map((r) => r.id);
    expect(new Set(runIds2).size).toBe(runIds2.length);
    for (const id of runIds) {
      expect(runIds2).toContain(id);
    }
    closeDb(opened.sqlite);
  });
});
