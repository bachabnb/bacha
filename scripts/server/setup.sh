#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for the three Bacha workers.
# Run as root. Safe to run again: it updates the code and leaves settings,
# keys and seeds alone.
#
#   curl -fsSL https://raw.githubusercontent.com/bachabnb/bacha/deploy-readiness/scripts/server/setup.sh | bash
#
# It installs Node and Foundry's cast, creates a `bacha` system user, checks
# the code out to /opt/bacha and installs the systemd services — without
# starting them. Keys come next, with install-keys.sh; the website with web.sh.
# Re-running it later updates the code and restarts whatever is running.
set -euo pipefail

BRANCH="${BACHA_BRANCH:-deploy-readiness}"
REPO="https://github.com/bachabnb/bacha.git"
[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }

export DEBIAN_FRONTEND=noninteractive
echo "== packages"
apt-get update -q
apt-get install -y -q git curl ca-certificates ufw unattended-upgrades >/dev/null

if ! node -v 2>/dev/null | grep -q '^v24\.'; then
  echo "== node 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -q nodejs >/dev/null
fi

if [ ! -x /root/.foundry/bin/cast ]; then
  echo "== foundry (cast is used once, to unlock the worker keys)"
  curl -fsSL https://foundry.paradigm.xyz | bash >/dev/null
  /root/.foundry/bin/foundryup >/dev/null
fi

# npm ci on a 1-2 GB server can run out of memory without swap.
if ! swapon --show | grep -q .; then
  echo "== 2G swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== user and directories"
id bacha >/dev/null 2>&1 || useradd --system --home-dir /var/lib/bacha --shell /usr/sbin/nologin bacha
install -d -o bacha -g bacha -m 700 /var/lib/bacha   # seed store — secret until revealed
install -d -o root -g root -m 700 /etc/bacha         # settings and keys, root only

echo "== code ($BRANCH)"
if [ -d /opt/bacha/.git ]; then
  git -C /opt/bacha fetch -q origin "$BRANCH"
  git -C /opt/bacha checkout -q "$BRANCH"
  git -C /opt/bacha reset -q --hard "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" /opt/bacha
fi
# Full install: building the website needs the dev dependencies too.
(cd /opt/bacha && npm ci --no-audit --no-fund --loglevel=error)

if [ ! -f /etc/bacha/worker.env ]; then
  cat > /etc/bacha/worker.env <<'EOF'
# Worker settings for a ~$100 float. Edit, then: systemctl restart bacha-<worker>
# Replace with a provider endpoint when you have one; the workers poll.
BACHA_RPC_URL=https://bsc-dataseed.bnbchain.org
BACHA_SEED_STORE=/var/lib/bacha/seeds.json
BACHA_COMMIT_BATCH=64
BACHA_COMMIT_LOW_WATER=16
BACHA_POLL_MS=4000
BACHA_TARGET_SPINS=5
BACHA_GAS_FLOOR_BNB=0.003
BACHA_RESERVE_BNB=0.005
BACHA_MAX_SPEND_PER_TICK_BNB=0.02
BACHA_SWEEP_MIN_BNB=0.002
BACHA_MAX_SLIPPAGE_BPS=200
BACHA_TREASURY_POLL_MS=30000
EOF
  chmod 600 /etc/bacha/worker.env
fi

echo "== services (installed, not started)"
install -m 644 /opt/bacha/scripts/server/systemd/bacha-*.service /etc/systemd/system/
systemctl daemon-reload

echo "== firewall: SSH only (the website is reached through the Cloudflare Tunnel)"
ufw allow OpenSSH >/dev/null
ufw --force enable >/dev/null

# Re-running setup is how the server is updated: pick up the new code in
# whatever is already running.
if [ -f /etc/bacha/web.env ]; then
  bash /opt/bacha/scripts/server/web.sh
fi
for s in randomness; do
  if systemctl is-active --quiet "bacha-$s"; then systemctl restart "bacha-$s" && echo "restarted bacha-$s"; fi
done

echo
echo "Setup done. First time? Continue with Step 6 of LAUNCH.md: copy the three"
echo "worker wallets and the launch settings here, then run install-keys.sh."
