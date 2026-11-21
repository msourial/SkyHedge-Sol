import type { ApiRequest, ApiResponse } from "./vercel-api.js";

const SECRET_KEYS = [
  "DATABASE_URL",
  "NOAA_TOKEN",
  "SOLANA_RPC_URL",
  "SOLANA_NETWORK",
  "IP_HASH_SALT",
  "ADMIN_TOKEN",
  "OPENROUTER_API_KEY",
  "ANTHROPIC_API_KEY",
  "X402_PAY_TO",
  "X402_QUOTE_PRICE_USDC",
  "X402_FACILITATOR_URL",
  "CRON_SECRET",
  "SETTLEMENT_AUTHORITY_KEYPAIR",
  "SKYHEDGE_PROGRAM_ID",
  "SKYT_MINT",
  "SKYHEDGE_DEVNET_CANCEL_EMPTY_DRAFT_READY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WEATHERXM_AGENT_BASE_URL",
] as const;

/** Copy Cloudflare Pages bindings into process.env before API modules load. */
export function hydrateProcessEnv(env: Record<string, unknown> | undefined): void {
  if (!env) return;
  for (const key of SECRET_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) process.env[key] = value;
  }
}

/**
 * Adapt a Fetch Request to the Node-style (req, res) handlers used by api/*.
 * Body is pre-parsed; handlers that also read the request stream will see req.body.
 */
export async function handleNodeApi(
  request: Request,
  handler: (req: ApiRequest, res: ApiResponse) => unknown | Promise<unknown>,
): Promise<Response> {
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: unknown;
  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
    const text = await request.text();
    if (text) {
      try { body = JSON.parse(text) as unknown; }
      catch { body = text; }
    }
  }

  const headers: Record<string, string | string[] | undefined> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    body,
    query,
    socket: { remoteAddress: request.headers.get("cf-connecting-ip") ?? "unknown" },
    async *[Symbol.asyncIterator]() {
      if (body === undefined || body === null) return;
      if (typeof body === "string") yield body;
      else yield JSON.stringify(body);
    },
  } as ApiRequest;

  let status = 200;
  const resHeaders = new Headers();
  let payload: unknown;
  let finished = false;
  let resolveResponse: (response: Response) => void = () => undefined;
  const done = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  const finish = () => {
    if (finished) return;
    finished = true;
    let responseBody: BodyInit | null = null;
    if (typeof payload === "string" || payload instanceof Uint8Array) responseBody = payload;
    else if (payload !== undefined) {
      if (!resHeaders.has("content-type")) resHeaders.set("content-type", "application/json; charset=utf-8");
      responseBody = JSON.stringify(payload);
    }
    resolveResponse(new Response(responseBody, { status, headers: resHeaders }));
  };

  const res = {
    statusCode: 200,
    setHeader(name: string, value: string | number | string[]) {
      resHeaders.set(name, Array.isArray(value) ? value.join(", ") : String(value));
      return this;
    },
    getHeader(name: string) {
      return resHeaders.get(name) ?? undefined;
    },
    status(code: number) {
      status = code;
      this.statusCode = code;
      return this;
    },
    json(value: unknown) {
      payload = value;
      if (!resHeaders.has("content-type")) resHeaders.set("content-type", "application/json; charset=utf-8");
      finish();
      return this;
    },
    end(value?: unknown) {
      if (value !== undefined) payload = value;
      finish();
      return this;
    },
    writeHead(code: number, maybeHeaders?: Record<string, string | string[]>) {
      status = code;
      this.statusCode = code;
      if (maybeHeaders) {
        for (const [name, value] of Object.entries(maybeHeaders)) {
          resHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
      }
      return this;
    },
  } as unknown as ApiResponse;

  await handler(req, res);
  if (!finished) finish();
  return done;
}

export function htmlShell(response: Response): Response {
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(response.body, { status: 200, headers });
}
