#!/usr/bin/env node
import { main } from "../src/cli.js";
void main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=codex-memory.js.map