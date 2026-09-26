import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializeSQLite } from "./host.js";
const file = process.argv[2];
if (!file) throw new Error("Usage: bun packages/sqlite/launch.js compiled-program.js [args]");
const host = await initializeSQLite();
process.argv = [process.argv[0], resolve(file), ...process.argv.slice(3)];
try { await import(pathToFileURL(resolve(file)).href); }
finally { host.dispose(); }
