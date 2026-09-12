import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getPlatformDb } from '@/lib/tenant-db';

const db = getPlatformDb();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.isActive) {
          // Log failed login attempt
          if (user && !user.isActive) {
            await db.auditLog.create({
              data: {
                companyId: user.companyId || null,
                userId: user.id,
                action: 'LOGIN_FAILED',
                entity: 'User',
                entityId: user.id,
                details: `Login failed - account inactive: ${credentials.email}`,
              },
            })
          }
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          // Log failed login - wrong password
          await db.auditLog.create({
            data: {
              companyId: user.companyId || null,
              userId: user.id,
              action: 'LOGIN_FAILED',
              entity: 'User',
              entityId: user.id,
              details: `Login failed - invalid password: ${credentials.email}`,
            },
          })
          return null
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        })

        // Create login audit log
        await db.auditLog.create({
          data: {
            companyId: user.companyId || null,
            userId: user.id,
            action: 'LOGIN',
            entity: 'User',
            entityId: user.id,
            details: `Successful login: ${user.email}`,
          },
        })

        // Create welcome notification
        await db.notification.create({
          data: {
            companyId: user.companyId || null,
            userId: user.id,
            type: 'auth',
            title: 'Login Successful',
            message: `Welcome back, ${user.name}! You logged in at ${new Date().toLocaleString()}`,
          },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.companyId = (user as any).companyId
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        (session.user as any).role = token.role
        (session.user as any).companyId = token.companyId
        (session.user as any).name = token.name
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || '3boxes-hrms-secret-key-2024',
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
