#!/usr/bin/env bash
# Setup idempotent untuk GCE VM Ubuntu 22.04 (reportgov-vm).
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/ukisyauqi/ReportGov.git}"
APP_DIR="$HOME/ReportGov"

echo "==> [1/7] apt update + base deps"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates gnupg unzip lsb-release

echo "==> [2/7] Node.js 20 (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version; npm --version

echo "==> [3/7] pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm i -g pm2
fi

echo "==> [4/7] GitHub CLI (gh)"
if ! command -v gh >/dev/null 2>&1; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y gh
fi

echo "==> [5/7] OpenCode CLI"
if ! command -v opencode >/dev/null 2>&1; then
  curl -fsSL https://opencode.ai/install | bash
  export PATH="$HOME/.opencode/bin:$PATH"
fi
export PATH="$HOME/.opencode/bin:$PATH"
opencode --version || true

echo "==> [6/7] Clone / update repo"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only || true
fi

echo "==> [7/7] npm ci + playwright + prisma + build"
cd "$APP_DIR"
npm ci
npx playwright install --with-deps chromium
npx prisma generate || true
npx prisma db push || true
npm run build

echo ""
echo "OK. Berikutnya:"
echo "  1. nano $APP_DIR/.env   (lihat deploy/app.env.example)"
echo "  2. pm2 start $HOME/deploy/ecosystem.config.cjs"
echo "  3. pm2 save"
