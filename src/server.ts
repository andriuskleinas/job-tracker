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
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Public calendar-feed endpoints are served here, ahead of the React router,
      // so they can return text/calendar and skip CSRF/auth middleware — calendar
      // apps fetch the feed with no auth header, carrying only the URL token.
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith("/calendar/tasks/") && pathname.endsWith(".ics")) {
        const { handleCalendarFeed } = await import("./lib/calendar-feed.server");
        return await handleCalendarFeed(request);
      }
      if (pathname === "/calendar/token") {
        const { handleCalendarTokenRequest } = await import("./lib/calendar-feed.server");
        return await handleCalendarTokenRequest(request);
      }
      if (pathname.startsWith("/calendar/google/")) {
        const google = await import("./lib/google-calendar.server");
        switch (pathname) {
          case "/calendar/google/callback":
            return await google.handleGoogleCallback(request);
          case "/calendar/google/auth-url":
            return await google.handleGoogleAuthUrl(request);
          case "/calendar/google/status":
            return await google.handleGoogleStatus(request);
          case "/calendar/google/disconnect":
            return await google.handleGoogleDisconnect(request);
          case "/calendar/google/sync":
            return await google.handleGoogleSync(request);
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
