import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const consumeAccessCodeFlash = request.nextUrl.pathname === "/app/access-code";
  if (process.env.BASIRA_BACKEND !== "supabase" || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const response = NextResponse.next({ request });
    if (consumeAccessCodeFlash) secureAccessCodeResponse(response);
    return response;
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  if (consumeAccessCodeFlash) secureAccessCodeResponse(response);
  return response;
}

function secureAccessCodeResponse(response: NextResponse) {
  // The request still carries the encrypted flash cookie to the Server
  // Component, while this response expires it. A refresh therefore cannot
  // reveal the code a second time. The path must match the original cookie.
  response.cookies.set("basira_access_code_flash", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/app/access-code",
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
