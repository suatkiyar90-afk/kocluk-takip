import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((request) => {
  const session = request.auth;
  const { pathname } = request.nextUrl;
  const role = session?.user?.role;

  if (pathname.startsWith("/login")) {
    if (session?.user) {
      const home = role === "teacher" || role === "admin" ? "/dashboard" : "/quiz-entry";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const isTeacherArea =
    pathname.startsWith("/dashboard") || pathname.startsWith("/students");

  if (isTeacherArea && role === "student") {
    return NextResponse.redirect(new URL("/quiz-entry", request.url));
  }

  const isStudentArea =
    pathname.startsWith("/quiz-entry") ||
    pathname.startsWith("/ask") ||
    pathname.startsWith("/mufredat");

  if (isStudentArea && role !== "student") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};