import { describe, expect, it } from "vitest";
import { parseAgentJson } from "./parse-output";

describe("Q3 JSON", () => {
  it("抽出 JSON 对象", () => {
    const j = parseAgentJson('前言\n{"summary":"ok","ownerUserId":"u1"}\n后');
    expect(j.summary).toBe("ok");
  });

  it("无 JSON 抛错", () => {
    expect(() => parseAgentJson("失败了")).toThrow();
  });
});
