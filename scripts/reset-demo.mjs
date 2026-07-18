import { rm } from "node:fs/promises";
import path from "node:path";
await rm(path.resolve(process.cwd(), process.env.BASIRA_DEMO_DB_PATH ?? ".data/basira-demo.json"), { force: true });
await rm(path.resolve(process.cwd(), process.env.BASIRA_DEMO_UPLOAD_DIR ?? ".data/uploads"), { recursive: true, force: true });
console.log("Demo data reset. It will be recreated on the next request.");
