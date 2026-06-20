import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function originFromEnv(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy() {
  const connectSrc = new Set([
    "'self'",
    "https://*.supabase.co",
    "https://*.supabase.in",
    "https://*.fly.dev",
    "wss://*.supabase.co",
  ]);
  const imgSrc = new Set(["'self'", "data:", "https:", "http:", "blob:"]);

  for (const origin of [
    originFromEnv(process.env.RECEIPTS_S3_ENDPOINT),
    originFromEnv(process.env.RECEIPTS_PUBLIC_BASE_URL),
  ]) {
    if (!origin) continue;
    connectSrc.add(origin);
    imgSrc.add(origin);
  }

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src ${Array.from(imgSrc).join(" ")}`,
    `connect-src ${Array.from(connectSrc).join(" ")}`,
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
  ].join("; ");
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      
      // Add Content Security Policy headers
      const headers = new Headers(normalizedResponse.headers);
      headers.set("Content-Security-Policy", buildContentSecurityPolicy());
      
      return new Response(normalizedResponse.body, {
        status: normalizedResponse.status,
        statusText: normalizedResponse.statusText,
        headers: headers
      });
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  }
};
