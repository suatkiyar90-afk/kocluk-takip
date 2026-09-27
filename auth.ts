import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "Giriş",
      credentials: {
        username: { label: "Kullanıcı Adı (e-posta)", type: "text" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;

        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        const rows = await db
          .select()
          .from(users)
          .where(or(eq(users.email, username), eq(users.studentNumber, username)))
          .limit(1);
        const user = rows[0];

        if (!user?.passwordHash || !user.email) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      } else if (token.id && token.role === "student") {
        const rows = await db
          .select({ flag: users.mustChangePassword })
          .from(users)
          .where(eq(users.id, token.id))
          .limit(1);
        if (rows[0]) {
          token.mustChangePassword = rows[0].flag;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id;
      }
      if (token.role) {
        session.user.role = token.role;
      }
      session.user.mustChangePassword = token.mustChangePassword === true;
      return session;
    },
  },
});