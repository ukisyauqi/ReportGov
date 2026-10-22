export { auth as middleware } from '@/auth';

export const config = {
  // Proteksi server-side untuk seluruh area admin.
  // Halaman publik (/, /lapor/[id]) tetap tanpa login.
  matcher: ['/admin', '/admin/:path*'],
};
