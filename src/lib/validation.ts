import { z } from 'zod';

export const KATEGORI_LIST = [
  'down',
  'bug-tampilan',
  'link-rusak',
  'konten-salah',
  'lambat',
  'tidak-bisa-diakses-hp',
  'keamanan',
  'lainnya',
] as const;

export const STATUS_LIST = [
  'baru',
  'diproses-ai',
  'pr-dibuat',
  'selesai',
  'ditolak',
] as const;

export const KATEGORI_LABELS: Record<(typeof KATEGORI_LIST)[number], string> = {
  down: 'Website Down / Tidak Bisa Diakses',
  'bug-tampilan': 'Bug Tampilan / UI Rusak',
  'link-rusak': 'Link Rusak / 404 Not Found',
  'konten-salah': 'Konten Salah / Tidak Akurat',
  lambat: 'Performa Lambat / Timeout',
  'tidak-bisa-diakses-hp': 'Tidak Responsif di HP (Mobile)',
  keamanan: 'Celah Keamanan / Deface',
  lainnya: 'Lainnya',
};

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5MB

export const createReportSchema = z.object({
  siteUrl: z
    .string()
    .trim()
    .url('Format URL tidak valid. Gunakan http:// atau https://')
    .refine(
      (val) => {
        try {
          const u = new URL(val);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'URL harus menggunakan protokol http:// atau https://' }
    ),
  kategori: z.enum(KATEGORI_LIST, {
    errorMap: () => ({ message: 'Pilih kategori masalah yang valid' }),
  }),
  judul: z
    .string()
    .trim()
    .min(10, 'Judul minimal 10 karakter')
    .max(200, 'Judul maksimal 200 karakter'),
  deskripsi: z
    .string()
    .trim()
    .min(
      20,
      'Deskripsi minimal 20 karakter (jelaskan langkah reproduksi & ekspektasi vs aktual)'
    )
    .max(10000, 'Deskripsi maksimal 10.000 karakter'),
  screenshot: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val) return true;
        if (!val.startsWith('data:image/')) return false;
        // Estimasi ukuran base64
        const base64Part = val.split(',')[1] || '';
        const byteLength = Math.ceil((base64Part.length * 3) / 4);
        return byteLength <= MAX_SCREENSHOT_BYTES;
      },
      { message: 'Screenshot harus berupa file gambar valid maksimal 5MB' }
    ),
  namaPelapor: z
    .string()
    .trim()
    .max(120, 'Nama pelapor maksimal 120 karakter')
    .optional()
    .nullable(),
  kontak: z
    .string()
    .trim()
    .max(120, 'Kontak maksimal 120 karakter')
    .optional()
    .nullable(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export function isGoIdUrl(siteUrl: string): boolean {
  try {
    const u = new URL(siteUrl);
    return u.hostname.toLowerCase().endsWith('.go.id');
  } catch {
    return false;
  }
}
