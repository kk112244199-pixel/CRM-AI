import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@hengce/domain";
import {
  flattenVitest,
  renderEvalMarkdown,
  rollupCases,
  type JsonTestResults,
} from "../packages/harness/src/eval-catalog";
import { loadRootEnv } from "../packages/harness/src/load-env";
import { hasLiveModelKey } from "../packages/harness/src/select-runner";

loadRootEnv();

const root = repoRoot();
const jsonPath = join(root, "data", "eval-vitest.json");
const mdPath = join(root, "docs", "eval-last-run.md");

mkdirSync(join(root, "data"), { recursive: true });

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const vitest = spawnSync(
  npx,
  [
    "vitest",
    "run",
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=${jsonPath}`,
  ],
  { cwd: root, stdio: "inherit", env: process.env, shell: process.platform === "win32" },
);

const live = hasLiveModelKey();

if (!existsSync(jsonPath)) {
  const fallback = renderEvalMarkdown({
    generatedAt: new Date().toISOString(),
    hasLiveModelKey: live,
    vitest: {
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      success: false,
    },
    cases: rollupCases([], {
      hasLiveModelKey: live,
    }),
  });
  writeFileSync(
    mdPath,
    fallback.replace(
      "脚本项如下表；真模型黄金切片已标明跳过，未假装通过。",
      `vitest 未写出 JSON（exit ${vitest.status ?? "null"}），全部记为缺失。不得手写通过。`,
    ),
    "utf8",
  );
  console.error(`eval:report 未找到 ${jsonPath}`);
  process.exit(1);
}

const json = JSON.parse(readFileSync(jsonPath, "utf8")) as JsonTestResults;
const cases = rollupCases(flattenVitest(json), { hasLiveModelKey: live });
const md = renderEvalMarkdown({
  generatedAt: new Date().toISOString(),
  hasLiveModelKey: live,
  vitest: {
    numTotalTests: json.numTotalTests ?? 0,
    numPassedTests: json.numPassedTests ?? 0,
    numFailedTests: json.numFailedTests ?? 0,
    numPendingTests: json.numPendingTests ?? 0,
    success: Boolean(json.success),
  },
  cases,
});
writeFileSync(mdPath, md, "utf8");
console.log(`wrote ${mdPath}`);

const blocking = cases.filter((c) => c.verdict === "未通过" || c.verdict === "缺失");
if (blocking.length > 0 || vitest.status !== 0) {
  process.exit(1);
}
