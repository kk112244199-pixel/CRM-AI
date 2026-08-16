import { describe, expect, it } from "vitest";
import {
  bootstrapMemoryDb,
  closeDb,
  handoffs,
  leads,
} from "@hengce/domain";
import { eq } from "drizzle-orm";
import { confirmHandoff, ingestLead, type HarnessCtx } from "./scheduler";
import { loadRootEnv } from "./load-env";
import { hasLiveModelKey, selectRunner } from "./select-runner";

loadRootEnv();
const hasKey = hasLiveModelKey();

describe.skipIf(!hasKey)("黄金切片 真模型", () => {
  it(
    "橙果跑到转化待确认（真模型）",
    async () => {
      const opened = bootstrapMemoryDb();
      const picked = selectRunner();
      const ctx: HarnessCtx = {
        db: opened.db,
        sqlite: opened.sqlite,
        runner: picked.runner,
      };
      try {
        await ingestLead(ctx, {
          leadId: "lead-chengguo",
          text: "林校长想给三个校区上销售跟进台账",
          role: "sales",
        });
        const hs = ctx.db
          .select()
          .from(handoffs)
          .where(eq(handoffs.leadId, "lead-chengguo"))
          .all();
        expect(hs.some((h) => h.agentId === "orchestrator")).toBe(true);
        expect(hs.some((h) => h.agentId === "lead-intake")).toBe(true);
        const conv = hs.find((h) => h.hitlKind === "confirm-convert");
        expect(conv?.status).toBe("待确认");
        await confirmHandoff(ctx, { handoffId: conv!.id, role: "sales" });
        const send = ctx.db
          .select()
          .from(handoffs)
          .where(eq(handoffs.leadId, "lead-chengguo"))
          .all()
          .find((h) => h.hitlKind === "confirm-send");
        expect(send?.status).toBe("待确认");
        const lead = ctx.db
          .select()
          .from(leads)
          .where(eq(leads.id, "lead-chengguo"))
          .get();
        expect(lead?.status).toBe("已转化");
      } finally {
        closeDb(opened.sqlite);
      }
    },
    180_000,
  );
});
