#!/usr/bin/env bash
# Deploy ReportGov ke Cloud Run + Cloud SQL (project: hackathon-primestep-12).
# Jalankan SETELAH instance reportgov-db READY.
# Usage: ./deploy/cloudrun-deploy.sh
set -euo pipefail

PROJECT="hackathon-primestep-12"
REGION="asia-southeast2"
REPO="reportgov"
DB_INSTANCE="reportgov-db"
DB_NAME="reportgov"
DB_USER="reportgov"
CONN_NAME="${PROJECT}:${REGION}:${DB_INSTANCE}"

export PATH="/opt/homebrew/bin:$PATH"

echo "==> [1/6] Pastikan DB user + database ada"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)}"
gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASS" 2>/dev/null || \
  gcloud sql users set-password "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASS"
gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE" 2>/dev/null || true
echo "DB_PASS tersimpan di: deploy/.dbpass (JANGAN commit)"
printf '%s' "$DB_PASS" > deploy/.dbpass
chmod 600 deploy/.dbpass

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${CONN_NAME}"

echo "==> [2/6] Build + push image wrapper"
gcloud builds submit --project="$PROJECT" --region="$REGION" \
  --config deploy/cloudbuild-wrapper.yaml .

echo "==> [3/6] Build + push image web"
gcloud builds submit --project="$PROJECT" --region="$REGION" \
  --config deploy/cloudbuild-web.yaml .

echo "==> [4/6] Deploy wrapper (timeout 15 mnt, CPU selalu dialokasikan)"
gcloud run deploy reportgov-wrapper --project="$PROJECT" --region="$REGION" \
  --image "${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/wrapper:latest" \
  --platform=managed --allow-unauthenticated \
  --memory=2Gi --cpu=2 --timeout=900 --cpu-boost \
  --min-instances=0 --max-instances=2 \
  --set-env-vars "OPENCODE_WAIT_TIMEOUT_MS=120000"

WRAPPER_URL="$(gcloud run services describe reportgov-wrapper --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
echo "WRAPPER_URL=$WRAPPER_URL"

echo "==> [5/6] Deploy web (butuh nilai .env produksi)"
: "${AUTH_SECRET:?set AUTH_SECRET dulu}"
: "${AUTH_GOOGLE_ID:?set AUTH_GOOGLE_ID dulu}"
: "${AUTH_GOOGLE_SECRET:?set AUTH_GOOGLE_SECRET dulu}"
: "${ADMIN_ALLOWED_EMAILS:?set ADMIN_ALLOWED_EMAILS dulu}"
: "${GITHUB_TOKEN:?set GITHUB_TOKEN dulu (boleh kosong string)}"
: "${OPENCODE_MODEL:=}"

gcloud run deploy reportgov-web --project="$PROJECT" --region="$REGION" \
  --image "${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/web:latest" \
  --platform=managed --allow-unauthenticated \
  --memory=2Gi --cpu=2 --timeout=300 \
  --min-instances=0 --max-instances=5 \
  --add-cloudsql-instances "$CONN_NAME" \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "WRAPPER_URL=${WRAPPER_URL}" \
  --set-env-vars "AUTH_SECRET=${AUTH_SECRET},AUTH_GOOGLE_ID=${AUTH_GOOGLE_ID},AUTH_GOOGLE_SECRET=${AUTH_GOOGLE_SECRET},ADMIN_ALLOWED_EMAILS=${ADMIN_ALLOWED_EMAILS}" \
  --set-env-vars "GITHUB_TOKEN=${GITHUB_TOKEN},OPENCODE_MODEL=${OPENCODE_MODEL},AI_TASK_TIMEOUT_MS=900000" \
  --set-env-vars "OPENCODE_WORKDIR=/tmp,OPENCODE_WAIT_TIMEOUT_MS=120000"

WEB_URL="$(gcloud run services describe reportgov-web --project="$PROJECT" --region="$REGION" --format='value(status.url)')"
echo ""
echo "SELESAI. WEB_URL=$WEB_URL"
echo "Daftarkan redirect URI Google OAuth: ${WEB_URL}/api/auth/callback/google"
