import nextWorker from "./.open-next/worker.js";
import { runWithCloudflareRequestContext } from "./.open-next/cloudflare/init.js";
import { createCloudflareWorker } from "./src/lib/server/cloudflare-worker.ts";

// Keep authenticated binary uploads out of Next's Node request conversion and
// rendering machinery. The same handler and authorization run on both hosts.
const worker = createCloudflareWorker(
  nextWorker,
  runWithCloudflareRequestContext,
);

export default worker;
