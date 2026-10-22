/**
 * Daftar email admin yang diizinkan login ke dashboard /admin.
 * Diisi via env ADMIN_ALLOWED_EMAILS (comma-separated).
 * Terpusat: semua admin melihat antrean laporan yang sama,
 * multi-user di sini hanya untuk identitas login, bukan routing laporan.
 */
export function getAllowedAdminEmails(): string[] {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return getAllowedAdminEmails().includes(email.trim().toLowerCase());
}
