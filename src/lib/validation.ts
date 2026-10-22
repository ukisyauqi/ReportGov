import { z } from 'zod';

export const STATUS_LIST = [
  'baru',
  'diproses-ai',
  'pr-dibuat',
  'selesai',
  'ditolak',
  'gagal',
] as const;

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
    .max(120, 'Email maksimal 120 karakter')
    .refine((val) => val.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message:
        'Format email tidak valid (contoh: nama@domain.com). Kosongkan jika tidak ingin mengisi email.',
    })
    .optional()
    .nullable(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const registeredSiteSchema = z.object({
  siteUrl: z
    .string()
    .trim()
    .min(1, 'Alamat website wajib diisi')
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
  repoUrl: z
    .string()
    .trim()
    .min(1, 'URL repo wajib diisi')
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(\.git)?\/?$/i,
      'Format repo tidak valid. Contoh: https://github.com/org/repo'
    ),
  note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable(),
  isActive: z.boolean().optional(),
});

export function isGoIdUrl(siteUrl: string): boolean {
  try {
    const u = new URL(siteUrl);
    return u.hostname.toLowerCase().endsWith('.go.id');
  } catch {
    return false;
  }
}
