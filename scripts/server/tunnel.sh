#!/usr/bin/env bash
# Connects the server to Cloudflare with a Cloudflare Tunnel. Run as root.
#
#   bash /opt/bacha/scripts/server/tunnel.sh
#
# The tunnel dials out to Cloudflare, so no web port is ever opened on the
# server: visitors reach the site only through Cloudflare, which terminates
# HTTPS and supplies the country header the region block depends on.
#
# Create the tunnel first in the Cloudflare dashboard (Zero Trust → Networks →
# Tunnels → Create a tunnel → Cloudflared), add a public hostname for your
# domain pointing at http://localhost:3000, and copy the token it shows.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "== installing cloudflared"
  install -d -m 0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -q >/dev/null
  apt-get install -y -q cloudflared >/dev/null
fi

if systemctl is-active --quiet cloudflared; then
  echo "cloudflared is already running. To change tunnels: cloudflared service uninstall, then rerun."
  exit 0
fi

read -r -s -p "Paste the tunnel token (it won't show): " token
echo
[ -n "$token" ] || { echo "No token given."; exit 1; }
cloudflared service install "$token" >/dev/null
unset token
systemctl is-active --quiet cloudflared && echo "Tunnel running. It shows as HEALTHY in the Cloudflare dashboard within a minute."
