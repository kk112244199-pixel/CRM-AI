import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@hengce/domain";

/**
 * 读仓库根 `.env`，不覆盖已经存在的环境变量。
 * 不打日志、不把值写进响应。文件不存在则跳过。
 */
export function loadRootEnv(): void {
  const file = join(repoRoot(), ".env");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
