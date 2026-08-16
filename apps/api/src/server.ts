import { existsSync } from "node:fs";
import {
  bootstrapFileDb,
  dbFilePath,
  migrate,
  openDb,
  rebuildLeadVec,
} from "@hengce/domain";
import { loadRootEnv, selectRunner } from "@hengce/harness";
import { createServer } from "./http";

loadRootEnv();

function openRuntimeDb() {
  const file = dbFilePath();
  if (!existsSync(file)) {
    bootstrapFileDb();
  }
  const opened = openDb(file);
  migrate(opened.sqlite);
  rebuildLeadVec(opened.sqlite);
  return opened;
}

const opened = openRuntimeDb();
const selected = selectRunner();
const server = createServer({
  db: opened.db,
  sqlite: opened.sqlite,
  runner: selected.runner,
  runnerKind: selected.kind,
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
server.listen(port, host, () => {
  console.log(
    `hengce-api ${selected.kind} on http://${host}:${port}/api/health`,
  );
});
