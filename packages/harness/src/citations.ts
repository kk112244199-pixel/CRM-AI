import { existsSync } from "node:fs";
import { join } from "node:path";
import { COMPANY_SLUGS, DOCUMENT_KINDS, corpusDir } from "@hengce/domain";

/** 语料相对路径，如 hangchi/handbook.md。Q8 对照磁盘，不评向量 Recall。 */
export function listCorpusRelPaths(): string[] {
  const paths: string[] = [];
  for (const slug of COMPANY_SLUGS) {
    for (const kind of DOCUMENT_KINDS) {
      paths.push(`${slug}/${kind}.md`);
    }
  }
  return paths;
}

export function corpusFileExists(rel: string, root?: string): boolean {
  const parts = rel.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length === 0) return false;
  return existsSync(join(corpusDir(root), ...parts));
}

/** 抽出像语料路径的 .md 引用，含幻觉文件名，供对照磁盘。 */
export function extractCitations(text: string): string[] {
  const found = new Set<string>();
  const withSlug = /\b[a-z0-9-]+\/[a-z0-9._-]+\.md\b/gi;
  const bare = /\b[a-z0-9._-]+\.md\b/gi;
  for (const m of text.match(withSlug) ?? []) found.add(m.toLowerCase());
  for (const m of text.match(bare) ?? []) found.add(m.toLowerCase());
  return [...found];
}

export function missingCitations(
  text: string,
  root?: string,
): { cited: string; ok: boolean }[] {
  return extractCitations(text).map((cited) => {
    if (cited.includes("/")) {
      return { cited, ok: corpusFileExists(cited, root) };
    }
    const ok = COMPANY_SLUGS.some((slug) =>
      corpusFileExists(`${slug}/${cited}`, root),
    );
    return { cited, ok };
  });
}
