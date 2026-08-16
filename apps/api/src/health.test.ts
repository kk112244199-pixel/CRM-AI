import { describe, expect, it } from "vitest";
import { handleHealth } from "./health";

describe("api health", () => {
  it("GET /api/health 返回 ok", () => {
    expect(handleHealth("/api/health")).toEqual({
      status: 200,
      body: JSON.stringify({ ok: true, service: "hengce-api" }),
    });
  });
});
