import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// The application does not use ISR. Prerendered routes stay in free static
// assets; the custom Worker calls the existing upload handler directly. Property
// details use a static shell with the existing authenticated browser data layer.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
