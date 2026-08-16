import { describe, expect, it } from "vitest";
import {
  EVAL_CASES,
  flattenVitest,
  renderEvalMarkdown,
  rollupCases,
} from "./eval-catalog";

describe("eval 对照表", () => {
  it("覆盖 Q1–Q8 与 R1–R6，含黄金切片单独一行", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    for (const id of [
      "Q1",
      "Q1-golden",
      "Q2",
      "Q3",
      "Q4",
      "Q5",
      "Q6",
      "Q7",
      "Q8",
      "R1",
      "R2",
      "R3",
      "R4",
      "R5",
      "R6",
    ]) {
      expect(ids).toContain(id);
    }
    expect(EVAL_CASES.filter((c) => c.golden).map((c) => c.id)).toEqual([
      "Q1-golden",
    ]);
  });

  it("无密钥时黄金切片记跳过，不得记成通过", () => {
    const all = flattenVitest({
      testResults: [
        {
          name: "D:\\\\repo\\\\packages\\\\harness\\\\src\\\\golden.test.ts",
          assertionResults: [
            {
              fullName: "黄金切片 Cursor SDK 橙果跑到转化待确认（真模型）",
              title: "橙果跑到转化待确认（真模型）",
              status: "skipped",
              failureMessages: [],
            },
          ],
        },
        {
          name: "packages/harness/src/scheduler.test.ts",
          assertionResults: [
            {
              fullName: "M2 顺序切片（无密钥） 橙果 ingest：分配、建档自动，转化待确认，无三对象，不拉跟进",
              title: "橙果 ingest：分配、建档自动，转化待确认，无三对象，不拉跟进",
              status: "passed",
              failureMessages: [],
            },
            {
              fullName: "M2 顺序切片（无密钥） 确认转化后才有三对象与跟进待发出；确认发出后电话生效",
              title: "确认转化后才有三对象与跟进待发出；确认发出后电话生效",
              status: "passed",
              failureMessages: [],
            },
          ],
        },
      ],
    });
    const rows = rollupCases(all, { hasCursorKey: false });
    const q1 = rows.find((r) => r.id === "Q1")!;
    const gold = rows.find((r) => r.id === "Q1-golden")!;
    expect(q1.verdict).toBe("通过");
    expect(gold.verdict).toBe("跳过");
    expect(gold.verdict).not.toBe("通过");
  });

  it("失败项带期望、实际、run_id；报告不把失败写成通过", () => {
    const all = flattenVitest({
      testResults: [
        {
          name: "packages/harness/src/crash-recovery.test.ts",
          assertionResults: [
            {
              fullName: "R1 崩溃后续跑 pipeline 前杀掉",
              title: "pipeline 前杀掉",
              status: "failed",
              failureMessages: [
                "expected handoffs to keep run-l9k2ab-x1y2z3 but duplicate inserted",
              ],
            },
          ],
        },
      ],
    });
    const rows = rollupCases(all, { hasCursorKey: false });
    const r1 = rows.find((r) => r.id === "R1")!;
    expect(r1.verdict).toBe("未通过");
    expect(r1.expected).toMatch(/handoff/);
    expect(r1.actual).toMatch(/duplicate/);
    expect(r1.runIds).toEqual(["run-l9k2ab-x1y2z3"]);
    const md = renderEvalMarkdown({
      generatedAt: "2026-08-17T00:00:00.000Z",
      hasCursorKey: false,
      vitest: {
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        numPendingTests: 0,
        success: false,
      },
      cases: rows,
    });
    expect(md).toMatch(/\*\*R1\*\*|### R1/);
    expect(md).toMatch(/相关 run_id：run-l9k2ab-x1y2z3/);
    const r1Row = md.split("\n").find((l) => l.startsWith("| R1 |"));
    expect(r1Row).toMatch(/未通过/);
    expect(r1Row).not.toMatch(/\| 通过 \|/);
  });
});
