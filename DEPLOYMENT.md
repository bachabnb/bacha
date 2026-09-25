# Deploying Bacha

Two things ship independently: the contracts, and the web app. The app runs
happily against no contracts at all (demo mode), so deploy them in that order
and nothing is ever broken in between.

---

## 0. Before you start

You need:

- a **multisig** for admin authority on mainnet — not an EOA
- a **committer key** for the randomness worker — a hot EOA holding gas only
- reward-token inventory to fund the vault with
- a deployer key holding only gas

> A single EOA holding `DEFAULT_ADMIN_ROLE` on a contract that custodies
> rewards is the weakest link in the whole design. The deploy script hands
> every role to `BACHA_ADMIN` and renounces the deployer's, but it is on you
> to point that at a multisig.

---

## 1. Contracts

### Testnet first

```bash
cd contracts
cp ../.env.example .env        # fill in the contract section
forge test                     # 70 tests must pass
```

Randomness is first-party: `BachaRandomness` is deployed alongside the game by
the same script, so there is no third-party coordinator to look up or fund.
What it does need is `BACHA_COMMITTER` — the address the reveal worker signs
with. Keep it separate from `BACHA_ADMIN`: it is a hot key, and the worst it
can do is refuse to reveal.

### Deploy

```bash
source .env

forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BSC_TESTNET_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $BSCSCAN_API_KEY \
  -vvvv
```

The script prints `BACHA_VAULT_ADDRESS`, `BACHA_GAME_ADDRESS` and
`BACHA_RANDOMNESS_ADDRESS`. It deliberately stops short of publishing a prize
table, activating tiers or committing seeds —
odds and inventory are an operational decision made against a funded vault,
not a deploy-time constant.

### Start the randomness worker

The beacon must hold committed seeds before anyone can spin. Until it does,
`spin()` reverts with `NoCommitmentAvailable` — the machine refuses to sell a
spin it cannot settle, which is the safe failure.

```bash
export BACHA_RPC_URL=...
export BACHA_RANDOMNESS_ADDRESS=...   # printed by the deploy script
export BACHA_COMMITTER_KEY=...        # the hot key, gas only
export BACHA_SEED_STORE=/var/lib/bacha/seeds.json

npm run randomness:commit   # one batch, to prove the wiring
npm run randomness:worker   # then run this as a service
```

> **Back up the seed store.** A commitment whose seed is lost can never be
> opened, and every spin bound to it must be refunded through the timeout.
> It is also secret until revealed — whoever holds it knows outcomes early.

The worker tops the queue up automatically and reveals each request once its
reveal block is mined. If it stops, spins accumulate as pending and become
refundable after `revealTimeout`; nothing is lost, but the machine stalls.

### Start the treasury worker

This is what makes the float self-funding. Every pass it sweeps spin revenue
out of the game, buys whatever inventory is below target, and funds the vault.

```bash
export BACHA_TREASURY_KEY=...      # hot key, game TREASURER_ROLE only
export BACHA_TARGET_SPINS=3        # concurrent spins to keep stocked

npm run treasury:plan              # dry run — prints what it would do
node scripts/treasury-worker.mjs --quote   # check routes before going live
npm run treasury:worker            # then run this as a service
```

Grant it `TREASURER_ROLE` on the **game** and nothing else:

```bash
cast send $BACHA_GAME_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "TREASURER_ROLE") $TREASURY_ADDRESS
```

> Do **not** give it `TREASURER_ROLE` on the vault. `vault.fund()` is
> permissionless, so restocking needs no vault role. With game-treasurer only,
> a stolen key can take unreserved spin revenue but cannot touch vault
> inventory, so recorded player rewards stay payable.

**Sizing the float.** The game reserves the *worst case* of every asset in the
table for each pending spin — not the expected payout. For the current table
that is about $18.60 per spin against a $1.83 expected payout, so roughly:

| Float | Concurrent pending spins |
|---|---|
| $100 | 5 |
| $250 | 13 |
| $500 | 26 |

The largest entry for each asset is what sets this, so the rarest prizes drive
working capital far more than they drive payout. Raising an epic amount costs
concurrency across the whole machine; check this table before doing it.

That is a throughput limit, not a solvency one. Spins settle in seconds, so
the cap only bites under bursts, and it lifts on its own as revenue accumulates.

**Routing.** Quotes go across PancakeSwap V2 *and* V3 at every fee tier, direct
and via USDT, and the best fill wins. This matters: measured against the
current roster, V2 alone would have bought B2 at roughly twice the market
price. Re-run `--quote` after any roster change.

### Set prize ceilings, then start the governor

A prize is a fixed number of tokens; a spin costs a fixed amount of BNB. RTP is
therefore not a constant — it is the ratio of two baskets that move apart. On
the current table, **if the reward roster gains 62% against BNB, RTP reaches
100%** and the machine stops making money on every spin.

The governor measures the RTP the published table is actually paying and, when
it leaves the band, republishes the same table with every amount scaled by one
factor. Weights, rarity split and band ordering are untouched; only size moves.
Spins already in flight keep the version they were stamped with.

It needs `OPERATOR_ROLE`, which is a larger privilege than the treasury
worker's. **Set a ceiling for every asset first** — it is the limit that key
cannot cross:

```bash
# Roughly 10x the largest intended prize, in token units.
cast send $BACHA_GAME_ADDRESS "setPrizeCeiling(address,uint256)" $TOKEN $MAX_UNITS
```

`setPrizeCeiling` is admin-only, so the operator key cannot raise its own
limit. The governor refuses to run against an asset with no ceiling set.

```bash
npm run governor:check    # dry run — prints measured RTP and the verdict
npm run governor          # then run this as a service
```

### Taking profit

The treasury worker takes profit **only** from surplus above the inventory
target and the BNB reserve, in that order. Set `BACHA_PROFIT_ADDRESS` to a cold
wallet to enable it; leave it unset to compound everything.

> **Do not take profit without the governor running.** Over 10k simulated spins
> with memecoin-grade volatility, profit-taking alone stalled the machine in
> **8.5%** of runs, because the buffer that would have absorbed RTP drift had
> been paid out. With the governor, the same policy stalled in **0.00%**.
> The governor is what makes profit-taking safe, not an optional extra.

| Configuration | Stalled | Median profit over 10k spins |
|---|---|---|
| No governor, no profit-taking | 1.0% | — |
| No governor, profit-taking | **8.5%** | $10,765 |
| Governor, no profit-taking | 0.0% | — |
| **Governor + profit-taking** | **0.0%** | **$10,528** |

Numbers are a model, not a forecast: they assume the spin volume stated, that
prices follow the modelled volatility, and that both workers stay running.

### Approve and fund reward assets

```bash
# For each reward asset, on the vault:
cast send $BACHA_VAULT_ADDRESS "setAssetApproved(address,bool)" $TOKEN true \
  --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY

# Funding is permissionless — anyone may top the vault up, and gains no claim
# by doing so. Approve, then fund:
cast send $TOKEN "approve(address,uint256)" $BACHA_VAULT_ADDRESS $AMOUNT ...
cast send $BACHA_VAULT_ADDRESS "fund(address,uint256)" $TOKEN $AMOUNT ...
```

The vault credits the **measured balance delta**, not the requested amount, so
an asset that takes a cut on transfer is accounted for by what actually
arrived.

### Publish a prize table and activate tiers

Author the table as JSON — amounts in **exact base units**, never decimals:

```json
{
  "prizes": [
    { "token": "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
      "amount": "1200000000000000000", "weight": 2600, "rarity": 0 }
  ],
  "tiers": [
    { "id": 0, "label": "QUICK", "price": "2600000000000000" }
  ]
}
```

Rarity: `0` common, `1` uncommon, `2` rare, `3` epic.

```bash
BACHA_TABLE_FILE=./tables/quick.json \
forge script script/PublishTable.s.sol:PublishTable \
  --rpc-url $BSC_RPC_URL --broadcast -vvvv
```

It prints `remainingFundedSpins` — how many spins the vault can actually
honour. **If that is zero, the machine will refuse every spin.** Fund more
before announcing anything.

The admin console at `/admin/tables` previews the same maths before you
commit: total weight, per-spin worst-case liability, and spins fundable
against real vault balances.

### Verify on BscScan

`--verify` during deploy usually handles it. If not:

```bash
forge verify-contract $BACHA_GAME_ADDRESS src/BachaGame.sol:BachaGame \
  --chain 56 \
  --etherscan-api-key $BSCSCAN_API_KEY \
  --constructor-args $(cast abi-encode \
    "constructor(address,address,address,(bytes32,uint256,uint16,uint32,bool))" \
    $BACHA_ADMIN $BACHA_VAULT_ADDRESS $BACHA_RANDOMNESS_ADDRESS)
```

Verified source is not optional here. The fairness page links people to the
contract and invites them to check the maths; unverified bytecode makes that
claim hollow.

### Hand over authority

```bash
# From the deployer, grant to the multisig:
cast send $BACHA_GAME_ADDRESS "grantRole(bytes32,address)" \
  $(cast keccak "OPERATOR_ROLE") $MULTISIG ...

# Then renounce the deployer's roles. Confirm with hasRole() before walking away.
```

---

## 2. Web app

### Configure

```
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_BSC_RPC_URL=<a dedicated endpoint, not the public dataseed>
NEXT_PUBLIC_BACHA_GAME_ADDRESS=0x...
NEXT_PUBLIC_BACHA_VAULT_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_SITE_URL=https://your-domain

COINGECKO_API_KEY=...
BACHA_ADMIN_TOKEN=$(openssl rand -hex 32)
```

Setting the two contract addresses is what flips the app out of demo mode.
Until then every result is labelled *Simulated* — which is correct, and should
not be worked around.

### Build

```bash
npm ci
npm run contracts:build && node scripts/export-abi.mjs   # if the ABI changed
npm run art:generate && npm run art:optimize             # once, then commit
npm run typecheck && npm run lint && npm test
npm run build
```

Artwork is committed, not generated at deploy time. `OPENAI_API_KEY` is only
needed by whoever regenerates it.

### Hosting

Any Node host running `npm run build && npm start` works. On Vercel the
defaults are correct; set the environment variables above and nothing else.

Middleware handles locale routing and the optional geofence, so it must run —
do not deploy the app as a purely static export.

---

## 3. Before you announce

- [ ] `remainingFundedSpins` is comfortably above zero for every active tier
- [ ] randomness worker is running, the beacon has committed seeds, and the seed store is backed up
- [ ] a test spin on mainnet settled and claimed end to end
- [ ] both contracts verified on BscScan
- [ ] admin roles held by the multisig; deployer roles renounced
- [ ] `BACHA_ADMIN_TOKEN` set to a long random value
- [ ] `/fairness` shows the right addresses and the published odds
- [ ] the demo ribbon is **gone** — its presence means contracts are not wired

---

## Operating

**Changing odds.** Publish a new version and repoint the tier. Existing
versions are never edited, so spins already in flight keep resolving against
what they were sold.

**Pausing.** `cast send $BACHA_GAME_ADDRESS "pause()"` stops new spins
immediately. It does not touch pending spins: they keep their locked table,
settle normally, and stay claimable. Deliberately not wired to a button in the
console — a pause should require the same key custody as any other privileged
action, not a session cookie.

**Withdrawing.** `BachaVault.withdraw` subtracts everything owed —
settled-unclaimed prizes plus the worst case for every pending spin — before
releasing anything. You cannot withdraw a player's reward, by construction.

**If randomness stalls.** After `revealTimeout` (default 3h) anyone can call
`refundExpiredSpin(spinId)` and the price returns to the wallet that paid it.
A refunded spin can never settle afterwards.

---

## Security notes

- `SETTLEMENT_PRIVATE_KEY` is optional and **not recommended as plaintext**.
  A settlement worker only calls `claimFor`, takes no custody, and cannot
  redirect a reward — but a hot key in an environment variable is still poor
  custody. Prefer a KMS/HSM signer, or leave it unset: players can always claim
  their own rewards.
- Never put a private key behind a `NEXT_PUBLIC_` prefix. That prefix means
  "inline this into the browser bundle", and there is no way to un-ship it.
- Reward assets are only as safe as the registry. Adding one means verifying
  the contract address against independent sources first — see the policy in
  `data/tokens.json` and `/admin/assets`.
