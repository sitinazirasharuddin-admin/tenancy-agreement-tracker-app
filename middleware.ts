import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/mockups" ||
    request.nextUrl.pathname.startsWith("/previews/")
  )
    return NextResponse.redirect(new URL("/", request.url));
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
