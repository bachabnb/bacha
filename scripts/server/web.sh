#!/usr/bin/env bash
# Configures, builds and (re)starts the website on the server. Run as root.
#
#   bash /opt/bacha/scripts/server/web.sh bacha.example.com   # first time
#   bash /opt/bacha/scripts/server/web.sh                     # rebuild after an update
#
# Settings live in /etc/bacha/web.env. The first run creates it from
# /etc/bacha/launch.env (contract addresses) and the domain, with a random
# admin token; later runs keep it, updating only the domain if one is given.
# NEXT_PUBLIC_* values are baked in at build time — edit web.env, then rerun.
set -euo pipefail

ETC=/etc/bacha
APP=/opt/bacha
domain="${1:-}"
[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }
[ -f "$ETC/launch.env" ] || { echo "Missing $ETC/launch.env — copy contracts/.env.launch there first."; exit 1; }

if [ ! -f "$ETC/web.env" ]; then
  [ -n "$domain" ] || { echo "First run needs the domain: web.sh bacha.example.com"; exit 1; }
  set -a; . "$ETC/launch.env"; . "$ETC/worker.env"; set +a
  umask 077
  cat > "$ETC/web.env" <<EOF
# Website settings. NEXT_PUBLIC_* are public and baked in at build time —
# after editing, run: bash $APP/scripts/server/web.sh
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_BSC_RPC_URL=https://bsc-dataseed.bnbchain.org
NEXT_PUBLIC_SITE_URL=https://$domain
NEXT_PUBLIC_BACHA_GAME_ADDRESS=$BACHA_GAME_ADDRESS
NEXT_PUBLIC_BACHA_VAULT_ADDRESS=$BACHA_VAULT_ADDRESS
NEXT_PUBLIC_BACHA_RANDOMNESS_ADDRESS=$BACHA_RANDOMNESS_ADDRESS
# Optional: a WalletConnect Cloud project id enables mobile wallets.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Server-only.
BACHA_RPC_URL=$BACHA_RPC_URL
# bStocks must not be offered to US persons. Add every other jurisdiction you
# cannot operate in.
BACHA_BLOCKED_COUNTRIES=US,PR,GU,VI,AS,MP,UM
# Unlocks /admin. Keep it private.
BACHA_ADMIN_TOKEN=$(openssl rand -hex 32)
COINGECKO_API_KEY=
EOF
  echo "Created $ETC/web.env (admin token: grep BACHA_ADMIN_TOKEN $ETC/web.env)"
elif [ -n "$domain" ]; then
  sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://$domain|" "$ETC/web.env"
fi

echo "== building (a few minutes on a small server)"
cd "$APP"
(set -a; . "$ETC/web.env"; set +a; NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 npx next build >/tmp/bacha-build.log 2>&1) || {
  tail -30 /tmp/bacha-build.log; echo "Build failed — full log in /tmp/bacha-build.log"; exit 1
}
# The server writes its page cache here at runtime.
chown -R bacha:bacha "$APP/.next"

install -m 644 "$APP/scripts/server/systemd/bacha-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --quiet bacha-web
systemctl restart bacha-web

printf "== waiting for the site"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'cf-ipcountry: DE' http://127.0.0.1:3000/en || true)
  [ "$code" = 200 ] && { echo " — up (HTTP 200)"; exit 0; }
  printf "."; sleep 2
done
echo; echo "The site did not answer. Logs: journalctl -u bacha-web -n 50"; exit 1
