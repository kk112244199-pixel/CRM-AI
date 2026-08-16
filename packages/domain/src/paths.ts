import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** 向上找到含 docs/PRD.md 的仓库根，避免从 packages 里相对路径算错库文件。 */
export function repoRoot(start = fileURLToPath(new URL(".", import.meta.url))): string {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "docs", "PRD.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("找不到仓库根（缺少 docs/PRD.md）");
}

export function dbFilePath(root = repoRoot()): string {
  const fromEnv = process.env.HENGCE_DB?.trim();
  if (fromEnv) return fromEnv;
  return join(root, "data", "hengce.db");
}

export function corpusDir(root = repoRoot()): string {
  return join(root, "data", "corpus");
}
