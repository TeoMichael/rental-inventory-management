import "server-only";
import { handlePhotoUpload } from "./photo-upload";

type Environment = Record<string, unknown>;
type NextWorker = {
  fetch(request: Request, env: Environment, ctx: unknown): Promise<Response>;
};
type RequestContext = (
  request: Request,
  env: Environment,
  ctx: unknown,
  handler: () => Promise<Response>,
) => Promise<Response>;

// Generated OpenNext modules are injected by the deployment entry point so the
// actual authorization boundary can also run in tests before Linux packaging.
export function createCloudflareWorker(
  nextWorker: NextWorker,
  runWithCloudflareRequestContext: RequestContext,
) {
  return {
    async fetch(request: Request, env: Environment, ctx: unknown) {
      const url = new URL(request.url);
      if (url.pathname === "/api/photos") {
        if (request.method !== "POST")
          return new Response(null, {
            status: 405,
            headers: { Allow: "POST", "Cache-Control": "no-store" },
          });
        return runWithCloudflareRequestContext(request, env, ctx, () =>
          handlePhotoUpload(request),
        );
      }
      const property = /^\/properties\/([A-Za-z0-9_-]{1,128})\/?$/.exec(
        url.pathname,
      );
      if (property && property[1] !== "detail") {
        url.pathname = "/properties/detail";
        url.search = "";
        url.searchParams.set("id", property[1]);
        return new Response(null, {
          status: 307,
          headers: { Location: url.href, "Cache-Control": "no-store" },
        });
      }
      return nextWorker.fetch(request, env, ctx);
    },
  };
}
