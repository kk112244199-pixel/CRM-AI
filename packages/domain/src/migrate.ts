import type { SqliteHandle } from "./db";

/** 与 schema.ts 列名对齐。无报价单/合同/充值表。documents 仍无 embedding 列；向量在 sqlite-vec 的 vec_leads。 */
export function migrate(sqlite: SqliteHandle): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      industry TEXT NOT NULL,
      status TEXT NOT NULL,
      owner_user_id TEXT REFERENCES users(id),
      contact_name TEXT NOT NULL,
      source_summary TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      search_tags TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      name TEXT NOT NULL,
      title TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      contact_id TEXT NOT NULL REFERENCES contacts(id),
      lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id),
      name TEXT NOT NULL,
      stage TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      effective INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      estimated_cny REAL NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES agent_runs(id),
      lead_id TEXT NOT NULL REFERENCES leads(id),
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      hitl_kind TEXT,
      proposed_stage TEXT,
      payload TEXT,
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      estimated_cny REAL NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_ledger (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES agent_runs(id),
      prompt_tokens INTEGER NOT NULL,
      completion_tokens INTEGER NOT NULL,
      estimated_cny REAL NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      slug TEXT NOT NULL,
      filename TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL
    );
  `);
  // 已有 M1 库补列；新库 CREATE 已含 payload
  try {
    sqlite.exec("ALTER TABLE handoffs ADD COLUMN payload TEXT");
  } catch {
    /* duplicate column */
  }
}
