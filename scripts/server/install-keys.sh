#!/usr/bin/env bash
# Unlocks the three worker wallets on the server, once. Run as root after
# copying, from your Mac:
#   ~/.foundry/keystores/bacha-{committer,treasury,operator}  ->  /root/keystores/
#   contracts/.env.launch                                     ->  /etc/bacha/launch.env
#
# Asks for the keystore password, checks each unlocked key belongs to the
# address in launch.env, writes it to /etc/bacha/<wallet>.env (root-only, read
# by systemd when a worker starts), then deletes the copied keystores. The
# password is never stored. The admin and deployer wallets never come here.
set -euo pipefail

ETC="${BACHA_ETC:-/etc/bacha}"
KS="${BACHA_KEYSTORES:-/root/keystores}"
APP="${BACHA_APP:-/opt/bacha}"
CAST="$(command -v cast || echo /root/.foundry/bin/cast)"

[ -f "$ETC/launch.env" ] || { echo "Missing $ETC/launch.env — copy contracts/.env.launch there first."; exit 1; }
for w in committer treasury operator; do
  [ -f "$KS/bacha-$w" ] || { echo "Missing $KS/bacha-$w — copy the keystore there first."; exit 1; }
done

expected() { (set -a; . "$ETC/launch.env"; eval "printf '%s' \"\${$1:-}\""); }

read -r -s -p "Wallet password: " password
echo

umask 077
for spec in committer:BACHA_COMMITTER:BACHA_COMMITTER_KEY treasury:BACHA_TREASURY:BACHA_TREASURY_KEY operator:BACHA_OPERATOR:BACHA_OPERATOR_KEY; do
  IFS=: read -r wallet addr_var key_var <<<"$spec"
  want="$(expected "$addr_var")"
  [ -n "$want" ] || { echo "$addr_var is not set in $ETC/launch.env"; exit 1; }

  key="$(CAST_UNSAFE_PASSWORD="$password" "$CAST" wallet decrypt-keystore --keystore-dir "$KS" "bacha-$wallet" 2>/dev/null \
    | grep -oE '0x[0-9a-fA-F]{64}' | head -1 || true)"
  [ -n "$key" ] || { unset password; echo "Could not unlock bacha-$wallet — wrong password?"; exit 1; }

  got="$(cd "$APP" && KEY="$key" node --input-type=module -e \
    "import { privateKeyToAccount } from 'viem/accounts'; console.log(privateKeyToAccount(process.env.KEY).address)")"
  if [ "$(printf '%s' "$got" | tr 'A-F' 'a-f')" != "$(printf '%s' "$want" | tr 'A-F' 'a-f')" ]; then
    unset password key
    echo "bacha-$wallet unlocks to $got, but launch.env says $addr_var=$want. Stopping."
    exit 1
  fi

  printf '%s=%s\n' "$key_var" "$key" > "$ETC/$wallet.env"
  chmod 600 "$ETC/$wallet.env"
  unset key
  echo "ok  $wallet  $got"
done
unset password

# The keys now live only in the root-only env files. Remove the copies.
for w in committer treasury operator; do
  if command -v shred >/dev/null 2>&1; then shred -u "$KS/bacha-$w"; else rm -f "$KS/bacha-$w"; fi
done
rmdir "$KS" 2>/dev/null || true

echo
echo "Keys installed. Start the randomness worker with: systemctl enable --now bacha-randomness"
