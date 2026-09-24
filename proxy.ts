import { NextResponse } from "next/server";
import { auth } from "@/auth";

const HOME_BY_ROLE: Record<string, string> = {
  admin: "/admin",
  teacher: "/dashboard",
  student: "/quiz-entry",
};

function homeFor(role?: string): string {
  return HOME_BY_ROLE[role ?? ""] ?? "/login";
}

export const proxy = auth((request) => {
  const session = request.auth;
  const { pathname } = request.nextUrl;
  const role = session?.user?.role;

  if (pathname.startsWith("/login")) {
    if (session?.user) {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
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

  if (pathname.startsWith("/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL(homeFor(role), request.url));
    }
    return NextResponse.next();
  }

  const isTeacherArea =
    pathname.startsWith("/dashboard") || pathname.startsWith("/students");

  if (isTeacherArea && role !== "teacher") {
    if (role === "admin") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  const isStudentArea =
    pathname.startsWith("/quiz-entry") ||
    pathname.startsWith("/deneme-sinavi") ||
    pathname.startsWith("/ask") ||
    pathname.startsWith("/mufredat");

  if (isStudentArea && role !== "student") {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(homeFor(role), request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};