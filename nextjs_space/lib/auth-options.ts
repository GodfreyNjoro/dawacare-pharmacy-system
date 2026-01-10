import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

declare module "next-auth" {
  interface User {
    role?: string;
    branchId?: string | null;
    branchName?: string | null;
  }
  interface Session {
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      role?: string;
      branchId?: string | null;
      branchName?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    branchId?: string | null;
    branchName?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            branch: {
              select: { id: true, name: true },
            },
          },
        });

        if (!user) {
          return null;
        }

        // Check if user is active
        if (user.status !== "ACTIVE") {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          branchName: user.branch?.name || null,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.branchId = token.branchId as string | null;
        session.user.branchName = token.branchName as string | null;
      }
      return session;
    },
  },
};
