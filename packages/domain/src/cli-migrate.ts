import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { closeDb, openDb } from "./db";
import { migrate } from "./migrate";
import { dbFilePath } from "./paths";

const file = dbFilePath();
mkdirSync(dirname(file), { recursive: true });
const { sqlite } = openDb(file);
migrate(sqlite);
closeDb(sqlite);
console.log(`migrated ${file}`);
