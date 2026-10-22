/**
 * Helper normalisasi & pencocokan Website Terdaftar <-> Repo.
 * Sumber kebenaran tunggal: tabel DB `RegisteredSite`.
 * File `config/site-to-repo.json` / `config/allowed-repos.txt` hanya fallback
 * baca (deprecated) bila DB kosong / tidak terjangkau.
 */

export interface RegisteredSiteRecord {
  siteUrl: string;
  repoUrl: string;
}

export function normalizeSiteInput(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

export function normalizeSiteForCompare(input: string): string {
  return normalizeSiteInput(input).toLowerCase();
}

export function normalizeRepoInput(input: string): string {
  // Bentuk kanonis: tanpa trailing slash dan tanpa sufiks .git
  let v = input.trim().replace(/\/+$/, '');
  v = v.replace(/\.git$/i, '');
  return v;
}

export function isValidSiteUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidGithubRepoUrl(v: string): boolean {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(\.git)?\/?$/i.test(v.trim());
}

/** Samakan logika pencocokan lama (full-url -> origin -> hostname). */
export function matchRepoForSiteUrl(
  siteUrl: string,
  sites: RegisteredSiteRecord[]
): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return undefined;
  }
  const origin = parsed.origin.toLowerCase();
  const normalizedFull = normalizeSiteForCompare(siteUrl);
  const hostname = parsed.hostname.toLowerCase();

  const byExact = sites.find(
    (s) =>
      normalizeSiteForCompare(s.siteUrl) === normalizedFull ||
      normalizeSiteForCompare(s.siteUrl) === origin ||
      normalizeSiteForCompare(s.siteUrl) === hostname
  );
  if (byExact) return byExact.repoUrl;

  for (const s of sites) {
    try {
      const kUrl = new URL(s.siteUrl);
      if (kUrl.hostname.toLowerCase() === hostname) return s.repoUrl;
    } catch {
      if (normalizeSiteForCompare(s.siteUrl) === hostname) return s.repoUrl;
    }
  }
  return undefined;
}
