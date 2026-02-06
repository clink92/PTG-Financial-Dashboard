import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

// Demo users - in production, use a database
const users = [
  {
    id: '1',
    email: 'admin@ptgfinancial.com',
    password: bcrypt.hashSync('PJM315g!', 10),
    name: 'Admin User',
    role: 'admin',
  },
  {
    id: '2',
    email: 'manager@ptgfinancial.com',
    password: bcrypt.hashSync('PJM315g!', 10),
    name: 'Property Manager',
    role: 'manager',
  },
  {
    id: '3',
    email: 'viewer@ptgfinancial.com',
    password: bcrypt.hashSync('PJM315g!', 10),
    name: 'Board Member',
    role: 'viewer',
  },
]

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password')
        }

        const user = users.find(u => u.email === credentials.email)
        
        if (!user) {
          throw new Error('No user found with this email')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isValid) {
          throw new Error('Invalid password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'ptg-financial-dashboard-secret-key-2025',
}

declare module 'next-auth' {
  interface User {
    role?: string
  }
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    id?: string
  }
}
