"use client";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

/** Browser-side call to the API (same origin, proxied to Express by Next.js). */
export async function apiFetch<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    window.location.href = "/login?expired=1";
    throw new ClientApiError(401, "Session expired");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fieldErrors = body?.details?.fieldErrors as Record<string, string[]> | undefined;
    const first = fieldErrors ? Object.entries(fieldErrors)[0] : undefined;
    const msg = first ? `${first[0]}: ${first[1][0]}` : (body.error ?? `Request failed (${res.status})`);
    throw new ClientApiError(res.status, msg, fieldErrors);
  }
  return body as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
