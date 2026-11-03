import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/styleguide", "/offline"];

/** Cheap gate: no session cookie means go to /login. The API still validates the session on every call. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("stms_session");
  if (!hasSession && !PUBLIC.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip the API proxy, Next internals, PWA files (service worker, manifest, icons) and static files.
  matcher: ["/((?!api|_next|sw\\.js|manifest\\.webmanifest|icons/|icon\\.svg|favicon\\.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
