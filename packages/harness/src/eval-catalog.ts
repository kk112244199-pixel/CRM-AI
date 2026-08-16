/** Q1–Q8 / R1–R6 与 vitest 用例的对照。结论只来自 JSON，禁止手写「通过」。 */

export type EvalCaseDef = {
  id: string;
  title: string;
  expected: string;
  /** 真模型；无密钥只许跳过，不得记成通过 */
  golden?: boolean;
  files: string[];
  titleRe: RegExp;
};

export const EVAL_CASES: EvalCaseDef[] = [
  {
    id: "Q1",
    title: "路由顺序（脚本切片）",
    expected:
      "橙果 ingest 只到转化待确认、不拉跟进；确认转化后才有三对象与跟进",
    files: ["scheduler.test.ts"],
    titleRe: /橙果 ingest|确认转化后才有/,
  },
  {
    id: "Q1-golden",
    title: "路由顺序（真模型黄金切片）",
    expected:
      "DASHSCOPE_API_KEY 或 CURSOR_API_KEY 下橙果跑到转化待确认，确认后到外发待确认，线索变为已转化",
    golden: true,
    files: ["golden.test.ts"],
    titleRe: /./,
  },
  {
    id: "Q2",
    title: "职责隔离",
    expected:
      "orchestrator 不写 accounts/opps；followup 不写 opp.stage；越权拒绝",
    files: ["scheduler.test.ts", "schema-seed.test.ts"],
    titleRe: /orchestrator 写 accounts|跟进不得改|系统分配不得写|建档不得写 stage/,
  },
  {
    id: "Q3",
    title: "结构化输出",
    expected: "非法 JSON 不得入库业务对象；解析失败抛错",
    files: ["parse-output.test.ts", "scheduler.test.ts"],
    titleRe: /Q3 JSON|抽出 JSON|无 JSON|非法 JSON/,
  },
  {
    id: "Q4",
    title: "人机协同",
    expected:
      "转化/外发确认前对象或活动未生效；赢单须 manager；中间阶段销售可推",
    files: ["scheduler.test.ts", "router.test.ts"],
    titleRe:
      /确认转化后才有|拒绝转化|销售可自推|销售不能确认赢单|杭齿建议赢单/,
  },
  {
    id: "Q5",
    title: "语料同宇宙",
    expected: "公司名只允许 8 家；语料八目录各五类文件",
    files: ["corpus.test.ts"],
    titleRe: /./,
  },
  {
    id: "Q6",
    title: "相似客户",
    expected: "杭齿→嘉兴精工；邻里鲜→夜灯；海图第一名不得是杭齿",
    files: ["search-similar.test.ts"],
    titleRe: /杭齿精密机电第一名|海图进出口第一名|邻里鲜超市第一名/,
  },
  {
    id: "Q7",
    title: "中文业务",
    expected: "线索状态与商机阶段皆中文，无 Discovery/Demo",
    files: ["schema-seed.test.ts"],
    titleRe: /八家名字|其余七家|阶段按 PRD|阶段中文/,
  },
  {
    id: "Q8",
    title: "幻觉（对照语料文件名）",
    expected: "引用须能指到 corpus 文件名；幻觉路径失败。相似召回见 Q6",
    files: ["citations.test.ts"],
    titleRe: /./,
  },
  {
    id: "R1",
    title: "崩溃恢复",
    expected:
      "pipeline 前杀掉再续跑：已落库 handoff 不丢；不重复插入同一 run_id",
    files: ["crash-recovery.test.ts"],
    titleRe: /./,
  },
  {
    id: "R2",
    title: "Token 台账",
    expected:
      "prompt_tokens + completion_tokens 有值；合计等于各 run 之和且等于 token_ledger",
    files: ["scheduler.test.ts", "router.test.ts"],
    titleRe: /Token 合计|顺序交卷到转化/,
  },
  {
    id: "R3",
    title: "失败可见",
    expected: "lead-intake 坏 schema 出现失败 handoff；后续 Agent 不改库",
    files: ["scheduler.test.ts"],
    titleRe: /非法 JSON 失败可见|建档不得写 stage/,
  },
  {
    id: "R4",
    title: "沙箱",
    expected: "orchestrator 写 accounts 被拒绝并记 audit_events",
    files: ["scheduler.test.ts"],
    titleRe: /orchestrator 写 accounts/,
  },
  {
    id: "R5",
    title: "权限",
    expected: "viewer 调改阶段 API 返回 403，库不变",
    files: ["router.test.ts"],
    titleRe: /viewer 推进阶段 403/,
  },
  {
    id: "R6",
    title: "密钥",
    expected: "前端包与语料、web-demo 无 DASHSCOPE_API_KEY / CURSOR_API_KEY",
    files: ["r6.test.ts", "sdk-shape.test.ts", "corpus.test.ts"],
    titleRe: /源码不含|web-demo 源码不含|八个目录各五类|前端包无密钥|不含 SDK 与密钥/,
  },
];

export type FlatTest = {
  file: string;
  fullName: string;
  title: string;
  status: string;
  failureMessages: string[];
};

export type CaseVerdict = "通过" | "未通过" | "跳过" | "缺失";

export type CaseResult = {
  id: string;
  title: string;
  expected: string;
  golden?: boolean;
  verdict: CaseVerdict;
  actual: string;
  runIds: string[];
  tests: { fullName: string; status: string; file: string }[];
};

type JsonAssertion = {
  ancestorTitles?: string[];
  fullName?: string;
  title?: string;
  status?: string;
  failureMessages?: string[] | null;
};

type JsonFileResult = {
  name?: string;
  assertionResults?: JsonAssertion[];
};

export type JsonTestResults = {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  success?: boolean;
  testResults?: JsonFileResult[];
};

export function normPath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function flattenVitest(json: JsonTestResults): FlatTest[] {
  const out: FlatTest[] = [];
  for (const file of json.testResults ?? []) {
    const fileName = normPath(file.name ?? "");
    for (const a of file.assertionResults ?? []) {
      out.push({
        file: fileName,
        fullName: a.fullName ?? a.title ?? "",
        title: a.title ?? "",
        status: a.status ?? "unknown",
        failureMessages: a.failureMessages ?? [],
      });
    }
  }
  return out;
}

export function fileMatches(file: string, suffixes: string[]): boolean {
  const f = normPath(file).toLowerCase();
  return suffixes.some((s) => f.endsWith(s.toLowerCase()));
}

export function testsForCase(all: FlatTest[], def: EvalCaseDef): FlatTest[] {
  return all.filter(
    (t) => fileMatches(t.file, def.files) && def.titleRe.test(t.fullName),
  );
}

const RUN_ID_RE = /\brun-[a-z0-9]+-[a-z0-9]+\b/gi;

export function extractRunIds(text: string): string[] {
  return [...new Set(text.match(RUN_ID_RE) ?? [])];
}

function isSkipStatus(status: string): boolean {
  return status === "skipped" || status === "pending" || status === "todo";
}

export function rollupCases(
  all: FlatTest[],
  opts: { hasLiveModelKey?: boolean; hasCursorKey?: boolean },
): CaseResult[] {
  const live = Boolean(opts.hasLiveModelKey ?? opts.hasCursorKey);
  return EVAL_CASES.map((def) => {
    const matched = testsForCase(all, def);
    const failed = matched.filter((t) => t.status === "failed");
    const passed = matched.filter((t) => t.status === "passed");
    const skipped = matched.filter((t) => isSkipStatus(t.status));
    const failText = failed
      .flatMap((t) => t.failureMessages)
      .join("\n")
      .trim();
    const runIds = extractRunIds(failText);

    if (failed.length > 0) {
      return {
        id: def.id,
        title: def.title,
        expected: def.expected,
        golden: def.golden,
        verdict: "未通过",
        actual: failText.slice(0, 1200) || "有失败断言，无 failureMessages",
        runIds,
        tests: matched.map((t) => ({
          fullName: t.fullName,
          status: t.status,
          file: t.file,
        })),
      };
    }

    if (matched.length === 0) {
      if (def.golden && !live) {
        return {
          id: def.id,
          title: def.title,
          expected: def.expected,
          golden: true,
          verdict: "跳过",
          actual: "vitest JSON 中无黄金切片用例（无真模型密钥，未假装通过）",
          runIds: [],
          tests: [],
        };
      }
      return {
        id: def.id,
        title: def.title,
        expected: def.expected,
        golden: def.golden,
        verdict: "缺失",
        actual: "本次 vitest JSON 中没有匹配到对应用例",
        runIds: [],
        tests: [],
      };
    }

    if (passed.length === 0 && skipped.length > 0) {
      return {
        id: def.id,
        title: def.title,
        expected: def.expected,
        golden: def.golden,
        verdict: "跳过",
        actual: def.golden
          ? "describe.skipIf：未设置真模型密钥，黄金切片跳过，未假装通过"
          : "匹配到的用例全部跳过",
        runIds: [],
        tests: matched.map((t) => ({
          fullName: t.fullName,
          status: t.status,
          file: t.file,
        })),
      };
    }

    if (def.golden && !live) {
      // 有密钥才允许把黄金切片记成通过
      return {
        id: def.id,
        title: def.title,
        expected: def.expected,
        golden: true,
        verdict: "跳过",
        actual: "未设置真模型密钥，即使有脚本结果也不得把真模型记成通过",
        runIds: [],
        tests: matched.map((t) => ({
          fullName: t.fullName,
          status: t.status,
          file: t.file,
        })),
      };
    }

    return {
      id: def.id,
      title: def.title,
      expected: def.expected,
      golden: def.golden,
      verdict: "通过",
      actual: `匹配 ${passed.length} 条通过` + (skipped.length ? `，${skipped.length} 条跳过` : ""),
      runIds: [],
      tests: matched.map((t) => ({
        fullName: t.fullName,
        status: t.status,
        file: t.file,
      })),
    };
  });
}

export function renderEvalMarkdown(input: {
  generatedAt: string;
  hasLiveModelKey?: boolean;
  hasCursorKey?: boolean;
  vitest: {
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    numPendingTests: number;
    success: boolean;
  };
  cases: CaseResult[];
}): string {
  const live = Boolean(input.hasLiveModelKey ?? input.hasCursorKey);
  const { cases } = input;
  const failed = cases.filter((c) => c.verdict === "未通过" || c.verdict === "缺失");
  const skipped = cases.filter((c) => c.verdict === "跳过");
  const passed = cases.filter((c) => c.verdict === "通过");

  const rows = cases
    .map(
      (c) =>
        `| ${c.id} | ${c.title} | ${c.verdict} | ${c.tests.map((t) => t.fullName).join("；") || "（无匹配测试）"} |`,
    )
    .join("\n");

  const failBlocks =
    failed.length === 0
      ? "无。\n"
      : failed
          .map((c) => {
            const run =
              c.runIds.length > 0 ? c.runIds.join(", ") : "n/a（本用例未落到 agent_runs 或失败信息中无 run_id）";
            return [
              `### ${c.id} ${c.title}`,
              "",
              `- 期望：${c.expected}`,
              `- 实际：${c.actual.replace(/\n/g, " ").slice(0, 800)}`,
              `- 相关 run_id：${run}`,
              "",
            ].join("\n");
          })
          .join("");

  const skipNote = skipped
    .map((c) => `- **${c.id}**：${c.actual}`)
    .join("\n");

  const headline = failed.length
    ? "有未通过或缺失项，见下方；不得把失败写成通过。"
    : skipped.some((c) => c.golden)
      ? "脚本项如下表；真模型黄金切片已标明跳过，未假装通过。"
      : "表内各项均来自本次 vitest JSON。";

  return `# 衡策销管平台 · 最近一次 eval

<!-- 由 npm run eval:report 根据 vitest JSON 生成，不要手写改结论。 -->

生成时间：${input.generatedAt}

${headline}

## 本次 vitest

| 项 | 值 |
|---|---|
| 总用例 | ${input.vitest.numTotalTests} |
| 通过 | ${input.vitest.numPassedTests} |
| 失败 | ${input.vitest.numFailedTests} |
| 跳过/pending | ${input.vitest.numPendingTests} |
| vitest success | ${input.vitest.success ? "true" : "false"} |
| 已设置真模型密钥 | ${live ? "是" : "否"} |

Q/R 汇总：通过 ${passed.length}，未通过/缺失 ${failed.length}，跳过 ${skipped.length}。

## 质量与可靠性

| ID | 验证 | 结果 | 依据（测试全名） |
|---|---|---|---|
${rows}

## 未通过项

未通过项必须带：用例 ID、期望、实际、相关 run_id。

${failBlocks}

## 跳过

${skipNote || "无。"}

## 不评估什么

不评估「像不像 GPT」。不评估电销接通率。向量 Recall@1 由 Q6 覆盖。
`;
}
