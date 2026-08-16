import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CORPUS, CORPUS_TITLES } from "./corpus";
import { DOCUMENT_KINDS } from "./enums";
import { corpusDir } from "./paths";

export function writeCorpusFiles(root?: string): string {
  const dir = corpusDir(root);
  for (const [slug, files] of Object.entries(CORPUS)) {
    const folder = join(dir, slug);
    mkdirSync(folder, { recursive: true });
    for (const kind of DOCUMENT_KINDS) {
      writeFileSync(join(folder, `${kind}.md`), files[kind], "utf8");
    }
  }
  return dir;
}

export { CORPUS_TITLES };
