import { load as loadSqliteVecExt } from "sqlite-vec";
import type { SqliteHandle } from "./db";

/** sqlite-vec 向量维数。八家客户够用，不上独立向量库。 */
export const VEC_DIM = 32;

/**
 * 领域轴互斥：制造 ↔ 外贸、制造 ↔ 零售 反向。
 * 这样海图不会因为哈希噪声贴到杭齿。仍是向量，不是标签计数。
 */
const AXES: { re: RegExp; plus: number[]; minus: number[] }[] = [
  {
    re: /离散制造|零部件|齿轮|齿轴|齿轮箱|MES|产线|传动|精工装备/,
    plus: [0, 1, 2],
    minus: [3, 4, 6, 7],
  },
  {
    re: /门店|会员|导购|生鲜|便利店|连锁零售|超市/,
    plus: [3, 4, 5],
    minus: [0, 1, 6, 7],
  },
  {
    re: /外贸|信用证|报关|提单|FOB|进出口/,
    plus: [6, 7, 8],
    minus: [0, 1, 2],
  },
  { re: /医疗|器械|经销授权/, plus: [9, 10], minus: [] },
  { re: /教培|校区|素质/, plus: [11, 12], minus: [] },
  { re: /市政|水务|国企|招标|投标/, plus: [13, 14], minus: [] },
];

export function loadSqliteVec(sqlite: SqliteHandle): void {
  loadSqliteVecExt(sqlite);
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function tokens(text: string): string[] {
  const out: string[] = [];
  const parts = text.split(/[^\u4e00-\u9fffA-Za-z0-9]+/);
  for (const raw of parts) {
    if (!raw) continue;
    const p = raw.toLowerCase();
    out.push(p);
    if (/[\u4e00-\u9fff]/.test(p)) {
      for (let i = 0; i < p.length - 1; i++) out.push(p.slice(i, i + 2));
    }
  }
  return out;
}

/** 把客户档案打成单位向量，供写入 vec_leads。 */
export function embedLeadText(text: string): number[] {
  const vec = new Array<number>(VEC_DIM).fill(0);
  for (const axis of AXES) {
    if (!axis.re.test(text)) continue;
    for (const d of axis.plus) vec[d] += 1;
    for (const d of axis.minus) vec[d] -= 1;
  }
  for (const tok of tokens(text)) {
    const h = hash32(tok);
    const i = 16 + (Math.abs(h) % (VEC_DIM - 16));
    vec[i] += h < 0 ? -0.05 : 0.05;
  }
  let n = 0;
  for (const x of vec) n += x * x;
  n = Math.sqrt(n) || 1;
  return vec.map((x) => x / n);
}

export function rebuildLeadVec(sqlite: SqliteHandle): void {
  loadSqliteVec(sqlite);
  sqlite.exec("DROP TABLE IF EXISTS vec_leads");
  sqlite.exec(
    `CREATE VIRTUAL TABLE vec_leads USING vec0(
      company TEXT PRIMARY KEY,
      embedding FLOAT[${VEC_DIM}]
    )`,
  );
  const rows = sqlite
    .prepare(
      "SELECT company, industry, search_tags AS searchTags FROM leads",
    )
    .all() as {
    company: string;
    industry: string;
    searchTags: string;
  }[];
  const ins = sqlite.prepare(
    "INSERT INTO vec_leads(company, embedding) VALUES (?, ?)",
  );
  for (const r of rows) {
    // 用档案（行业+标签）做向量。语料全文留给 Q8 引用，避免八家套话把距离拉平。
    const text = `${r.company} ${r.industry} ${r.searchTags.replace(/,/g, " ")}`;
    ins.run(r.company, JSON.stringify(embedLeadText(text)));
  }
}
