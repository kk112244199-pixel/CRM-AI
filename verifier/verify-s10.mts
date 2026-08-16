// Verifier-only independent smoke check of S10 HTTP behavior.
// Runs the real router against a fresh in-memory seeded DB. Not target source.
import { bootstrapMemoryDb, closeDb, accounts, leads } from "@hengce/domain";
import { scriptedRunner } from "@hengce/harness";
import { handleApi, type ApiCtx } from "../apps/api/src/router";

function ctx(): ApiCtx & { close: () => void } {
  const opened = bootstrapMemoryDb();
  return {
    db: opened.db,
    sqlite: opened.sqlite,
    runner: scriptedRunner(),
    runnerKind: "scripted",
    close: () => closeDb(opened.sqlite),
  };
}

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  const tag = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`[${tag}] ${name}${extra !== undefined ? " :: " + JSON.stringify(extra) : ""}`);
}

async function main() {
  // status=新线索
  {
    const c = ctx();
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/leads?status=" + encodeURIComponent("新线索"),
      headers: {},
    });
    const body = JSON.parse(res.body) as { leads: { company: string; status: string }[] };
    check("GET ?status=新线索 -> 200", res.status === 200, res.status);
    check("  includes 橙果素质教育", body.leads.some((l) => l.company === "橙果素质教育"));
    check("  all status=新线索", body.leads.every((l) => l.status === "新线索"));
    c.close();
  }
  // stage=方案报价
  {
    const c = ctx();
    const res = await handleApi(c, {
      method: "GET",
      url: "/api/leads?stage=" + encodeURIComponent("方案报价"),
      headers: {},
    });
    const names = (JSON.parse(res.body) as { leads: { company: string }[] }).leads.map((l) => l.company);
    check("GET ?stage=方案报价 -> 200", res.status === 200, res.status);
    check("  includes 杭齿精密机电", names.includes("杭齿精密机电"), names);
    check("  includes 邻里鲜超市", names.includes("邻里鲜超市"));
    c.close();
  }
  // bad stage -> 400
  {
    const c = ctx();
    const res = await handleApi(c, { method: "GET", url: "/api/leads?stage=not-a-stage", headers: {} });
    check("GET ?stage=not-a-stage -> 400", res.status === 400, res.status);
    c.close();
  }
  // import viewer 403, db unchanged
  {
    const c = ctx();
    const before = c.db.select().from(leads).all().length;
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/import",
      headers: { "x-hengce-role": "viewer" },
      body: JSON.stringify({ csv: "company,industry,contactName,sourceSummary\nA,B,C,D" }),
    });
    check("POST import viewer -> 403", res.status === 403, res.status);
    check("  db unchanged", c.db.select().from(leads).all().length === before);
    c.close();
  }
  // import sales -> new 新线索, skip dup, no account
  {
    const c = ctx();
    const accBefore = c.db.select().from(accounts).all().length;
    const csv = [
      "company,industry,contactName,sourceSummary",
      "验证导入甲,行业,联系人,摘要",
      "橙果素质教育,教培,林校长,重复",
    ].join("\n");
    const res = await handleApi(c, {
      method: "POST",
      url: "/api/leads/import",
      headers: { "x-hengce-role": "sales" },
      body: JSON.stringify({ csv }),
    });
    const body = JSON.parse(res.body) as { ok: boolean; imported: { company: string }[]; skipped: { company: string }[] };
    check("POST import sales -> 200", res.status === 200, res.status);
    check("  ok true", body.ok === true);
    check("  imported 验证导入甲", body.imported.map((r) => r.company).includes("验证导入甲"), body.imported);
    check("  skipped 橙果素质教育", body.skipped.some((s) => s.company === "橙果素质教育"));
    check("  no new account", c.db.select().from(accounts).all().length === accBefore);
    const row = c.db.select().from(leads).all().find((l) => l.company === "验证导入甲");
    check("  inserted status=新线索", row?.status === "新线索", row?.status);
    check("  lastActivity=CSV 导入", row?.lastActivity === "CSV 导入", row?.lastActivity);
    c.close();
  }
  console.log(`\nTOTAL FAILURES: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
