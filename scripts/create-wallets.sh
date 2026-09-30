#!/usr/bin/env bash
# Creates the five Bacha launch wallets as encrypted Foundry keystores, all
# locked with one password, and writes their public addresses to
# contracts/.env.launch. Prints addresses only — never a private key.
#
#   bash scripts/create-wallets.sh
#
# Any earlier bacha-* keystores are moved aside (never deleted) first.
set -euo pipefail

DIR="$HOME/.foundry/keystores"
NAMES=(bacha-deployer bacha-admin bacha-committer bacha-operator bacha-treasury)
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/contracts/.env.launch"

mkdir -p "$DIR"

existing=()
for n in "${NAMES[@]}"; do [ -e "$DIR/$n" ] && existing+=("$n"); done
if [ ${#existing[@]} -gt 0 ]; then
  backup="$HOME/.foundry/keystores-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$backup"
  for n in "${existing[@]}"; do mv "$DIR/$n" "$backup/"; done
  echo "Moved earlier wallets (${existing[*]}) to $backup"
  echo
fi

echo "Choose ONE password for all five wallets. Nothing shows while you type."
while true; do
  read -r -s -p "Password: " pw1; echo
  read -r -s -p "Same password again: " pw2; echo
  if [ -z "$pw1" ]; then echo "The password can't be empty."; continue; fi
  if [ "$pw1" != "$pw2" ]; then echo "They didn't match — try again."; continue; fi
  break
done
export CAST_PASSWORD="$pw1"
unset pw1 pw2

declare -a ADDRS
for n in "${NAMES[@]}"; do
  out=$(cast wallet new "$DIR" "$n")
  addr=$(printf '%s\n' "$out" | grep -oE '0x[0-9a-fA-F]{40}' | head -1)
  if [ -z "$addr" ]; then echo "Could not create $n:"; printf '%s\n' "$out"; exit 1; fi
  ADDRS+=("$addr")
done
unset CAST_PASSWORD

cat > "$ENV_FILE" <<EOF
# Bacha launch — public values only. Never put a private key in this file.
BSC_RPC_URL=https://bsc-dataseed.bnbchain.org
DEPLOYER=${ADDRS[0]}
BACHA_ADMIN=${ADDRS[1]}
BACHA_COMMITTER=${ADDRS[2]}
BACHA_OPERATOR=${ADDRS[3]}
BACHA_TREASURY=${ADDRS[4]}
BACHA_TABLE_FILE=./tables/bacha.json
EOF

echo
echo "Done. Your five wallets:"
echo
printf '  %-10s %s   send %s BNB\n' \
  deployer  "${ADDRS[0]}" 0.001 \
  admin     "${ADDRS[1]}" 0.002 \
  committer "${ADDRS[2]}" 0.004 \
  operator  "${ADDRS[3]}" 0.001 \
  treasury  "${ADDRS[4]}" 0.115
echo
echo "Saved to contracts/.env.launch"
echo "Now save the password in a password manager, and back up the folder $DIR"
