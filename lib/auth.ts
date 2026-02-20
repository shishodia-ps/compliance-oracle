import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile',
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[AUTH] Login attempt:', credentials?.email);

        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials');
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          console.log('[AUTH] User not found:', credentials.email);
          return null;
        }

        if (!user.password) {
          console.log('[AUTH] User has no password (OAuth only?)');
          return null;
        }

        console.log('[AUTH] Found user, checking password...');
        const isValid = await compare(credentials.password, user.password);
        console.log('[AUTH] Password valid:', isValid);

        if (!isValid) {
          return null;
        }

        console.log('[AUTH] Login successful for:', user.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log('[AUTH] SignIn callback:', {
        provider: account?.provider,
        email: user.email,
        hasAccount: !!account,
      });

      // Handle OAuth sign-ins
      if (account?.provider === 'google') {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { accounts: true },
        });

        if (existingUser) {
          // User exists - check if Google account is linked
          const hasGoogleAccount = existingUser.accounts.some(
            (acc) => acc.provider === 'google'
          );

          if (!hasGoogleAccount) {
            // Link Google account to existing user
            console.log('[AUTH] Linking Google account to existing user:', user.email);
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
            });
          }
        } else {
          // New user - create organization for them
          console.log('[AUTH] Creating new user with organization:', user.email);
          const org = await prisma.organization.create({
            data: {
              name: `${user.name || user.email}'s Organization`,
              slug: `org-${Date.now()}`,
            },
          });

          await prisma.organizationMember.create({
            data: {
              userId: user.id,
              organizationId: org.id,
              role: 'ADMIN',
            },
          });
        }

        return true;
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.image = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Only log in debug mode (reduces terminal spam)
      if (process.env.NEXTAUTH_DEBUG === 'true') {
        console.log('[AUTH] Redirect callback:', { url, baseUrl });
      }

      // Handle OAuth callbacks
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      // Allow redirects to same origin
      if (url.startsWith(baseUrl)) {
        return url;
      }

      // Default redirect to app
      return `${baseUrl}/app`;
    },
  },

  events: {
    async signIn({ user, isNewUser, account }) {
      console.log('[AUTH] SignIn event:', {
        userId: user.id,
        email: user.email,
        isNewUser,
        provider: account?.provider,
      });

      // Log sign-in for audit
      if (user.id) {
        try {
          const membership = await prisma.organizationMember.findFirst({
            where: { userId: user.id },
          });

          await prisma.auditLog.create({
            data: {
              userId: user.id,
              organizationId: membership?.organizationId,
              action: isNewUser ? 'SIGNUP' : 'LOGIN',
              resourceType: 'auth',
              details: {
                isNewUser,
                provider: account?.provider || 'credentials',
              },
            },
          });
        } catch (e) {
          console.error('[AUTH] Failed to create audit log:', e);
        }
      }
    },

    async signOut({ token }) {
      console.log('[AUTH] SignOut event:', { userId: token.sub });

      if (token.sub) {
        try {
          const membership = await prisma.organizationMember.findFirst({
            where: { userId: token.sub },
          });

          await prisma.auditLog.create({
            data: {
              userId: token.sub,
              organizationId: membership?.organizationId,
              action: 'LOGOUT',
              resourceType: 'auth',
              details: {},
            },
          });
        } catch (e) {
          console.error('[AUTH] Failed to create audit log:', e);
        }
      }
    },

    async createUser({ user }) {
      // Only log in debug mode
      if (process.env.NEXTAUTH_DEBUG === 'true') {
        console.log('[AUTH] CreateUser event:', { userId: user.id, email: user.email });
      }
    },
  },

  // Debug mode - set NEXTAUTH_DEBUG=true in .env to enable detailed logging
  debug: process.env.NEXTAUTH_DEBUG === 'true',
};

// Extend session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }

  interface User {
    role: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
