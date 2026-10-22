# ReportGov — Deploy ke GCE VM (project: hackathon-primestep-12)
# Strategi: 1 VM Ubuntu 22.04 menjalankan semua proses via PM2 (SQLite, tanpa Docker).
# Proses: Next.js :3000, wrapper :3001 (auto-start opencode serve via Service.ensure()).

## 0. Prasyarat di laptop

```sh
gcloud auth login
gcloud config set project hackathon-primestep-12
gcloud services enable compute.googleapis.com
```

## 1. Buat VM

```sh
gcloud compute instances create reportgov-vm \
  --project=hackathon-primestep-12 \
  --zone=asia-southeast2-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=http-server,https-server
```

## 2. Buka firewall HTTP/HTTPS (sekali saja)

```sh
gcloud compute firewall-rules create allow-http-https \
  --project=hackathon-primestep-12 \
  --allow=tcp:80,tcp:443,tcp:3000 \
  --target-tags=http-server,https-server 2>/dev/null || true
```

## 3. Copy & jalankan setup di VM

```sh
gcloud compute scp --zone=asia-southeast2-a \
  deploy/vm-setup.sh deploy/ecosystem.config.cjs \
  reportgov-vm:~/deploy/

gcloud compute ssh reportgov-vm --zone=asia-southeast2-a --command="chmod +x ~/deploy/vm-setup.sh && ~/deploy/vm-setup.sh"
```

`vm-setup.sh` menginstall: Node 20, git, gh, opencode, Playwright OS deps +
chromium, pm2, clone repo, `npm ci`, `prisma db push`, `next build`.

## 4. Isi .env di VM, lalu start

```sh
gcloud compute ssh reportgov-vm --zone=asia-southeast2-a

nano ~/ReportGov/.env   # isi dari deploy/app.env.example (lihat bawah)
pm2 start ~/deploy/ecosystem.config.cjs
pm2 save && pm2 startup  # ikuti instruksi output agar reboot-proof
pm2 logs
```

Isi `.env` wajib:
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_GOOGLE_ID="<client-id>"
AUTH_GOOGLE_SECRET="<client-secret>"
ADMIN_ALLOWED_EMAILS="admin1@gmail.com"
# Google redirect URI yang didaftarkan:
# http://<VM-IP>/api/auth/callback/google  (atau domain bila ada)
WRAPPER_URL="http://localhost:3001"
OPENCODE_URL=""
GITHUB_TOKEN="<ghp_...>"
OPENCODE_MODEL=""
```

## 5. Cek

- `http://<VM-IP>:3000` form publik
- `http://<VM-IP>:3000/admin` login Google allowlist
- Di VM: `curl localhost:3001/health`, `pm2 status`

## Catatan hackathon

- SQLite cukup karena 1 VM. Jangan pakai Cloud Run tanpa migrasi ke Postgres
  (`schema.prisma` masih `sqlite`).
- Harness butuh `gh auth login` di VM bila ingin PR otomatis:
  `gh auth login` lalu restart web (`pm2 restart reportgov-web`).
- Playwright butuh `npx playwright install --with-deps chromium` (sudah di setup script).
- Untuk domain + HTTPS rapi, pasang Nginx reverse proxy :80 -> :3000 (opsional).
