#!/usr/bin/env bash
# Runs one worker by hand, with the same settings and key its service uses —
# for the one-off checks in LAUNCH.md. Run as root.
#
#   bash /opt/bacha/scripts/server/run.sh randomness --once
set -euo pipefail

ETC="${BACHA_ETC:-/etc/bacha}"
role="${1:-}"
shift || true
case "$role" in
  randomness) wallet=committer; script=randomness-worker.mjs ;;
  *) echo "usage: run.sh randomness [worker flags]"; exit 1 ;;
esac

# Two copies of a worker sign with the same key and collide on nonces.
if systemctl is-active --quiet "bacha-$role"; then
  echo "bacha-$role is running as a service. Stop it first: systemctl stop bacha-$role"
  exit 1
fi

set -a
. "$ETC/launch.env"
. "$ETC/worker.env"
. "$ETC/$wallet.env"
set +a

cd /opt/bacha
exec runuser -u bacha -- node "scripts/$script" "$@"
