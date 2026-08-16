import { bootstrapFileDb } from "./bootstrap";
import { dbFilePath } from "./paths";

const file = bootstrapFileDb();
console.log(`seeded ${file} (canonical path ${dbFilePath()})`);
