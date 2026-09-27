import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "student" | "teacher" | "admin";
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "student" | "teacher" | "admin";
    mustChangePassword?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: "student" | "teacher" | "admin";
    mustChangePassword?: boolean;
  }
}
