import { afterEach, describe, expect, it } from "vitest";
import { dbFilePath, repoRoot } from "./paths";
import { join } from "node:path";

describe("db 路径", () => {
  const prev = process.env.HENGCE_DB;
  afterEach(() => {
    if (prev === undefined) delete process.env.HENGCE_DB;
    else process.env.HENGCE_DB = prev;
  });

  it("默认落在仓库 data/hengce.db", () => {
    delete process.env.HENGCE_DB;
    expect(dbFilePath()).toBe(join(repoRoot(), "data", "hengce.db"));
  });

  it("HENGCE_DB 供容器 volume 使用", () => {
    process.env.HENGCE_DB = "/data/hengce.db";
    expect(dbFilePath()).toBe("/data/hengce.db");
  });
});
