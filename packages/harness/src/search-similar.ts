import type { SqliteHandle } from "@hengce/domain";
import { rebuildLeadVec } from "@hengce/domain";

export type SimilarHit = { company: string; score: number };

/**
 * sqlite-vec KNN。查询公司自己的向量，按 L2 距离升序，排除自身。
 * 锁：杭齿第一名嘉兴精工装备；邻里鲜第一名夜灯便利；海图第一名不得是杭齿。
 */
export function searchSimilar(
  sqlite: SqliteHandle,
  queryCompany: string,
): SimilarHit[] {
  rebuildLeadVec(sqlite);
  const q = sqlite
    .prepare("SELECT embedding FROM vec_leads WHERE company = ?")
    .get(queryCompany) as { embedding: Buffer } | undefined;
  if (!q) return [];
  const rows = sqlite
    .prepare(
      `SELECT company, distance
       FROM vec_leads
       WHERE embedding MATCH ? AND k = 8`,
    )
    .all(q.embedding) as { company: string; distance: number }[];
  return rows
    .filter((r) => r.company !== queryCompany)
    .sort(
      (a, b) => a.distance - b.distance || a.company.localeCompare(b.company, "zh"),
    )
    .map((r) => ({
      company: r.company,
      score: 1 / (1 + r.distance),
    }));
}
