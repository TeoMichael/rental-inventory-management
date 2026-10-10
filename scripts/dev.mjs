import { existsSync } from "node:fs";

// Load runtime secrets without Node CLI env-file flags, which Next's dev
// restart would propagate into NODE_OPTIONS. OpenNext builds do not embed .dev.vars.
if (existsSync(".dev.vars")) process.loadEnvFile(".dev.vars");
await import("next/dist/bin/next");
