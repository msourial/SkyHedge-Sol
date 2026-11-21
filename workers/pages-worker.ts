import { handleNodeApi, hydrateProcessEnv, htmlShell } from "../server/services/cf-fetch-adapter.js";
import type { ApiRequest, ApiResponse } from "../server/services/vercel-api.js";

type Env = Record<string, unknown> & { ASSETS: { fetch: (request: Request) => Promise<Response> } };
type ExecutionContextLike = { waitUntil?: (promise: Promise<unknown>) => void };

const CHAIN_GET_CACHE_SECONDS = 45;
const CHAIN_GET_CACHE_PATHS = new Set(["/api/health", "/api/devnet/status", "/api/quotes", "/api/mobile"]);

function isCacheableChainGet(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return CHAIN_GET_CACHE_PATHS.has(path);
}

async function cachedChainGet(request: Request, ctx?: ExecutionContextLike): Promise<Response> {
  const url = new URL(request.url);
  if (!isCacheableChainGet(request, url)) return handleApi(request);
  const store = (globalThis as unknown as { caches?: { default?: { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> } } }).caches?.default;
  if (!store) return handleApi(request);
  const cacheKey = new Request(url.toString(), { method: "GET", headers: { accept: "application/json" } });
  const hit = await store.match(cacheKey);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("cf-cache-status", "HIT");
    return new Response(hit.body, { status: hit.status, headers });
  }
  const response = await handleApi(request);
  if (response.status !== 200) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, s-maxage=${CHAIN_GET_CACHE_SECONDS}`);
  const cached = new Response(response.body, { status: 200, headers });
  const put = store.put(cacheKey, cached.clone());
  if (ctx?.waitUntil) ctx.waitUntil(put);
  else await put;
  return cached;
}

let apiReady: Promise<void> | undefined;
const handlers: Record<string, (req: ApiRequest, res: ApiResponse) => unknown | Promise<unknown>> = {};

function asHandler(mod: unknown, name: string): (req: ApiRequest, res: ApiResponse) => unknown | Promise<unknown> {
  const candidate = (mod as { default?: unknown })?.default ?? mod;
  const fn = typeof candidate === "function"
    ? candidate
    : typeof (candidate as { default?: unknown })?.default === "function"
      ? (candidate as { default: (req: ApiRequest, res: ApiResponse) => unknown | Promise<unknown> }).default
      : undefined;
  if (!fn) throw new Error(`No function export for ${name}`);
  return fn as (req: ApiRequest, res: ApiResponse) => unknown | Promise<unknown>;
}

async function loadApiModules(): Promise<void> {
  const modules: Array<[string, () => Promise<unknown>]> = [
    ["/api/health", () => import("../api/health.js")],
    ["/api/waitlist", () => import("../api/waitlist/index.js")],
    ["/api/devnet/status", () => import("../api/devnet/status.js")],
    ["/api/quotes", () => import("../api/quotes.js")],
    ["/api/weatherxm/latest", () => import("../api/weatherxm/latest.js")],
    ["/api/transactions/unsigned", () => import("../api/transactions/unsigned.js")],
    ["/api/x402/quote", () => import("../api/x402/quote.js")],
    ["/api/evidence-package", () => import("../api/evidence-package.js")],
    ["/api/advisory", () => import("../api/advisory.js")],
    ["/api/mobile", () => import("../api/mobile.js")],
    ["/api/cron/settlement", () => import("../api/cron/settlement.js")],
    ["/api/cron/windows", () => import("../api/cron/windows.js")],
  ];
  const results = await Promise.allSettled(modules.map(async ([path, load]) => {
    handlers[path] = asHandler(await load(), path);
  }));
  const failed = results
    .map((result, index) => result.status === "rejected" ? `${modules[index][0]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}` : null)
    .filter((row): row is string => Boolean(row));
  if (failed.length) {
    console.error("api module load failures", failed);
  }
}

function rewriteApi(url: URL): URL {
  const next = new URL(url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/api/waitlist/export") {
    next.pathname = "/api/waitlist";
    next.searchParams.set("action", "export");
    return next;
  }
  if (path === "/api/waitlist/count") {
    next.pathname = "/api/waitlist";
    next.searchParams.set("action", "count");
    return next;
  }
  if (path === "/api/markets/des-moines/evidence-package") {
    next.pathname = "/api/evidence-package";
    return next;
  }

  const claim = path.match(/^\/api\/markets\/([^/]+)\/positions\/([^/]+)\/claim-readiness$/);
  if (claim) {
    next.pathname = "/api/mobile";
    next.searchParams.set("resource", "claim-readiness");
    next.searchParams.set("market", decodeURIComponent(claim[1]));
    next.searchParams.set("wallet", decodeURIComponent(claim[2]));
    return next;
  }

  const portfolio = path.match(/^\/api\/portfolio\/([^/]+)$/);
  if (portfolio) {
    next.pathname = "/api/mobile";
    next.searchParams.set("resource", "portfolio");
    next.searchParams.set("wallet", decodeURIComponent(portfolio[1]));
    return next;
  }

  return next;
}

function publicErrorMessage(err: unknown): { error: string; name: string; message: string } {
  const name = err instanceof Error ? err.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return { error: "worker_exception", name, message: message.slice(0, 400) };
}

async function handleApi(request: Request): Promise<Response> {
  try {
    const rewritten = rewriteApi(new URL(request.url));
    const path = rewritten.pathname.replace(/\/+$/, "") || "/";
    if (!apiReady) {
      apiReady = loadApiModules().catch((err) => {
        apiReady = undefined;
        throw err;
      });
    }
    await apiReady;
    const handler = handlers[path];
    if (!handler) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const forwarded = new Request(rewritten, request);
    return await handleNodeApi(forwarded, handler);
  } catch (err) {
    return new Response(JSON.stringify(publicErrorMessage(err)), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContextLike): Promise<Response> {
    hydrateProcessEnv(env);
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return cachedChainGet(request, ctx);
    }

    if (pathname === "/app") {
      const next = new URL(url);
      next.pathname = "/app/";
      return Response.redirect(next, 308);
    }

    if (pathname === "/app/") {
      return env.ASSETS.fetch(request);
    }

    if (pathname.startsWith("/app/")) {
      const last = pathname.split("/").pop() || "";
      if (last.includes(".")) return env.ASSETS.fetch(request);
      return htmlShell(await env.ASSETS.fetch(new Request(new URL("/app/__app_shell", url), request)));
    }

    const last = pathname.split("/").pop() || "";
    if (pathname === "/" || last.includes(".")) {
      return env.ASSETS.fetch(request);
    }
    return htmlShell(await env.ASSETS.fetch(new Request(new URL("/__landing_shell", url), request)));
  },
};
