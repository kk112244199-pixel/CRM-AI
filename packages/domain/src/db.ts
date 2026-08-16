import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { loadSqliteVec } from "./vec";

export type SqliteHandle = Database.Database;
export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

export function openDb(filename: string): { sqlite: SqliteHandle; db: AppDb } {
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  // 每开库加载 sqlite-vec。相似检索走扩展，不上 Pinecone。
  loadSqliteVec(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

export function closeDb(sqlite: SqliteHandle): void {
  sqlite.close();
}
