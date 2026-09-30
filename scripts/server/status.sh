#!/usr/bin/env bash
# One screen of health: services, wallet gas, randomness queue, funded spins.
#   bash /opt/bacha/scripts/server/status.sh
set -uo pipefail

ETC="${BACHA_ETC:-/etc/bacha}"
set -a
. "$ETC/launch.env"
. "$ETC/worker.env"
set +a
CAST="$(command -v cast || echo /root/.foundry/bin/cast)"
R="$BACHA_RPC_URL"

echo "services"
for s in randomness; do
  printf '  %-11s %s\n' "$s" "$(systemctl is-active "bacha-$s" 2>/dev/null)"
done

echo "gas"
for pair in "committer:$BACHA_COMMITTER"; do
  printf '  %-11s %s BNB\n' "${pair%%:*}" "$("$CAST" balance "${pair#*:}" --ether --rpc-url "$R")"
done

echo "machine"
printf '  seeds ready   %s\n' "$("$CAST" call "$BACHA_RANDOMNESS_ADDRESS" 'availableCommitments()(uint256)' --rpc-url "$R")"
printf '  spins so far  %s\n' "$("$CAST" call "$BACHA_GAME_ADDRESS" 'spinCount()(uint256)' --rpc-url "$R")"
version="$("$CAST" call "$BACHA_GAME_ADDRESS" 'getTier(uint8)((bool,bool,uint96,uint64,string))' 0 --rpc-url "$R" | awk -F', ' '{print $4}')"
printf '  funded spins  %s (table v%s)\n' "$("$CAST" call "$BACHA_GAME_ADDRESS" 'remainingFundedSpins(uint64)(uint256)' "$version" --rpc-url "$R")" "$version"
printf '  paused        %s\n' "$("$CAST" call "$BACHA_GAME_ADDRESS" 'paused()(bool)' --rpc-url "$R")"
printf '  bankroll      %s BNB (owes %s)\n' "$("$CAST" balance "$BACHA_GAME_ADDRESS" --ether --rpc-url "$R")" "$("$CAST" from-wei "$("$CAST" call "$BACHA_GAME_ADDRESS" 'obligations()(uint256)' --rpc-url "$R" | awk '{print $1}')")"
