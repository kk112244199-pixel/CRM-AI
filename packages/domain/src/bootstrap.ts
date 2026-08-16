import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { closeDb, openDb, type AppDb, type SqliteHandle } from "./db";
import { migrate } from "./migrate";
import { dbFilePath } from "./paths";
import { seed } from "./seed";
import { rebuildLeadVec } from "./vec";
import { writeCorpusFiles } from "./write-corpus";

export function createMemoryDb(): { sqlite: SqliteHandle; db: AppDb } {
  const { sqlite, db } = openDb(":memory:");
  migrate(sqlite);
  return { sqlite, db };
}

export function bootstrapMemoryDb(): { sqlite: SqliteHandle; db: AppDb } {
  const opened = createMemoryDb();
  seed(opened.db);
  rebuildLeadVec(opened.sqlite);
  return opened;
}

export function bootstrapFileDb(root?: string): string {
  writeCorpusFiles(root);
  const file = dbFilePath(root);
  mkdirSync(dirname(file), { recursive: true });
  rmSync(file, { force: true });
  const { sqlite, db } = openDb(file);
  migrate(sqlite);
  seed(db);
  rebuildLeadVec(sqlite);
  closeDb(sqlite);
  return file;
}
