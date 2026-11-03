import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fetch from Express in a server component, forwarding the session cookie. Redirects to /login on 401. */
export async function api<T>(path: string): Promise<T> {
  const jar = await cookies();
  const res = await fetch(`${API}/api${path}`, {
    headers: { cookie: jar.toString(), accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login?expired=1");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Like api(), but returns null on 404 so pages can call notFound(). */
export async function apiOrNull<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
