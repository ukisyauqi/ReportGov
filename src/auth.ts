import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { isAdminEmail } from '@/lib/admin-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Percaya host request (dev di port acak / deploy di balik proxy).
  // Untuk produksi bisa juga set AUTH_URL ke URL kanonis.
  trustHost: true,
  // JWT session: tanpa tabel DB tambahan. Multi-user hanya untuk
  // identitas login; daftar laporan tetap terpusat untuk semua admin.
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    // Login with Google saja (sesuai kebutuhan).
    Google,
  ],
  callbacks: {
    // Tolak login Google yang email-nya tidak ada di allowlist.
    async signIn({ user }) {
      return isAdminEmail(user?.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.email && session.user) {
        session.user.email = token.email as string;
      }
      return session;
    },
    // Dipakai oleh middleware: hanya email allowlist yang boleh /admin*.
    authorized({ auth: session, request }) {
      if (request.nextUrl.pathname.startsWith('/admin')) {
        return isAdminEmail(session?.user?.email);
      }
      return true;
    },
  },
});
