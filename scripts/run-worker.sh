#!/usr/bin/env bash
# Starts one Bacha worker, unlocking its wallet from the Foundry keystore.
#
#   bash scripts/run-worker.sh randomness [--commit-only | --once]
#
# The one worker: commits and reveals randomness, and delivers each settled
# prize by swapping its BNB into the stock on PancakeSwap.
#
# Asks for the keystore password, decrypts the key into this process's memory
# and hands it to the worker through its environment. The key is never written
# to disk or printed. Addresses and contract settings come from
# contracts/.env.launch; the defaults below are the $100 launch values and can
# be overridden by exporting the variable first.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

role="${1:-}"
shift || true
case "$role" in
  randomness) account=bacha-committer; key_var=BACHA_COMMITTER_KEY; script=scripts/randomness-worker.mjs ;;
  *) echo "usage: bash scripts/run-worker.sh randomness [worker flags]"; exit 1 ;;
esac

if [ ! -f contracts/.env.launch ]; then
  echo "contracts/.env.launch is missing — run scripts/create-wallets.sh first."; exit 1
fi
set -a
# shellcheck disable=SC1091
source contracts/.env.launch
set +a

export BACHA_RPC_URL="${BACHA_RPC_URL:-$BSC_RPC_URL}"
# Outside the repo so a clean checkout can never lose it. Back this file up:
# a seed that is lost can never be revealed.
export BACHA_SEED_STORE="${BACHA_SEED_STORE:-$HOME/.bacha/seeds.json}"
export BACHA_COMMIT_BATCH="${BACHA_COMMIT_BATCH:-64}"
export BACHA_COMMIT_LOW_WATER="${BACHA_COMMIT_LOW_WATER:-16}"
export BACHA_MAX_SLIPPAGE_BPS="${BACHA_MAX_SLIPPAGE_BPS:-200}"

read -r -s -p "Wallet password for $account: " password
echo
key=$(CAST_UNSAFE_PASSWORD="$password" cast wallet decrypt-keystore "$account" 2>/dev/null | grep -oE '0x[0-9a-fA-F]{64}' | head -1 || true)
unset password
if [ -z "$key" ]; then
  echo "Could not unlock $account — wrong password, or the keystore is missing."; exit 1
fi
export "$key_var=$key"
unset key

# Keep the Mac from idling to sleep while the worker runs (a closed lid
# still sleeps it).
if command -v caffeinate >/dev/null 2>&1; then
  exec caffeinate -i node "$script" "$@"
fi
exec node "$script" "$@"
