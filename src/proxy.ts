import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const { pathname } = url;

  const { url: supabaseUrl, publishableKey: supabaseKey, disableAuth } = readSupabaseEnv();

  // If Supabase/auth is disabled, let everything through (local dev mode).
  if (disableAuth || !supabaseUrl || !supabaseKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except Next internals, static files, and API routes (APIs auth themselves).
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
