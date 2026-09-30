# Deploying Bacha

What is live, how it fits together, and how to change it safely. For the
original first-launch walkthrough (wallet creation, first funding) see
`LAUNCH.md`; where the two disagree, this file is current.

---

## Live on BNB Chain mainnet

### Contracts

| Contract | Address | Notes |
|---|---|---|
| **BachaGame** | [`0xf85b4ae5a43387da702d9b5db368cfa4128f6157`](https://bscscan.com/address/0xf85b4ae5a43387da702d9b5db368cfa4128f6157) | Current game. Buy-at-spin, `spinMany` up to 25. Block 124973227. |
| **BachaRandomness** | [`0x3C825aed2854ED84cD8D6683eE9826C13c3e7367`](https://bscscan.com/address/0x3C825aed2854ED84cD8D6683eE9826C13c3e7367) | Commit–reveal beacon, shared across game upgrades. Reveal delay 2 blocks. |

Prize table: `contracts/tables/bacha.json`, published as **version 1** on the
current game. One tier, `0` / "BACHA", at **0.0026 BNB** a spin. Refund
timeout (`revealTimeout`) is 3 hours.

### Retired contracts

Nothing live points at these. They hold no funds and owe nothing.

| Contract | Address | Retired |
|---|---|---|
| BachaGame (buy-at-spin, single spin only) | `0x3fB3b94455b12b897B057246a18fE330e8fB1b20` | Replaced by the current game. Paused, beacon access revoked, bankroll moved. |
| BachaGame (vault design) | `0x406c4e5166188219FFcAc1dd31c0367Fb153F794` | Replaced by buy-at-spin. Beacon access revoked. |
| BachaVault | `0x49B98cF4D2eC644776F6d91F4C00c54902763792` | Emptied; stock withdrawn to the admin wallet. |

Spins made on a retired game do not appear on the site, which reads only the
current game.

### Wallets and roles

All five are Foundry keystores in `~/.foundry/keystores` on the owner's Mac,
named `bacha-<role>`. Addresses are also in `contracts/.env.launch`.

| Wallet | Address | Holds |
|---|---|---|
| `bacha-admin` | `0x25c23Cbc13a92A0cb1143E8608C30e63b72bC916` | Game `DEFAULT_ADMIN`, `OPERATOR`, `TREASURER`; beacon `DEFAULT_ADMIN` |
| `bacha-committer` | `0x970Ee31f265a39c5463C8d9091A861Db6C15C30d` | Beacon `COMMITTER`; game `SETTLER`. The worker's hot key — gas only. |
| `bacha-deployer` | `0x1A49A273b89709c37a34b48E61165EaC4b6A416C` | Nothing. Deploys contracts, holds a little gas. |
| `bacha-operator` | `0xa0205F8e64842fCF1acE2E6166DDc4a4D855A618` | Nothing — unused since the governor was retired. |
| `bacha-treasury` | `0x6842b7a0785D9917490541f9B245be4Cf9C79C32` | Nothing — unused since the treasury worker was retired. |

### Hosting

| Piece | Where | Config |
|---|---|---|
| Website | Vercel, production branch `main` → `www.bacha.fun` | `NEXT_PUBLIC_BACHA_GAME_ADDRESS`, `NEXT_PUBLIC_BACHA_RANDOMNESS_ADDRESS` (Config type) |
| Randomness worker | Railway project *cooperative-nature*, service `randomness` | `Dockerfile.workers`, `BACHA_WORKER=randomness`, `BACHA_GAME_ADDRESS`, `BACHA_RANDOMNESS_ADDRESS`, committer key; seed store on the `/data` volume |
| Wallet modal | Reown project `bc92f3593e8b9859ceb450323b647150` | Allowlist `bacha.fun` and `www.bacha.fun` in the Reown dashboard |

---

## How it works

1. A player pays `price` (or `price × count` through `spinMany`, 1–25). Each
   spin reserves the table's biggest prize from the bankroll and takes the
   beacon's next committed seed. If either is short, the purchase reverts
   whole.
2. The worker reveals the seed a couple of blocks later. The beacon calls the
   game, which picks the prize from the spin's locked table version.
3. The worker buys the prize on PancakeSwap (best of V2 and V3, direct or via
   USDT) and `deliver`s it straight to the player. The recipient is fixed by
   the contract.
4. If delivery stalls, the player can `payInBnb` for the prize's BNB value.
   If randomness never comes, anyone can `refundExpiredSpin` after 3 hours.

The game holds only BNB. There is no stock inventory to keep topped up; the
bankroll just needs enough BNB to reserve the biggest prize for every spin in
flight.

---

## Health check

From `contracts/`, with `set -a && source .env.launch && set +a` first:

```bash
cast balance $BACHA_GAME_ADDRESS --ether --rpc-url $BSC_RPC_URL                            # bankroll
cast call $BACHA_GAME_ADDRESS "obligations()(uint256)" --rpc-url $BSC_RPC_URL              # owed right now
cast call $BACHA_GAME_ADDRESS "remainingFundedSpins(uint64)(uint256)" 1 --rpc-url $BSC_RPC_URL
cast call $BACHA_RANDOMNESS_ADDRESS "availableCommitments()(uint256)" --rpc-url $BSC_RPC_URL  # seeds ready
cast balance $BACHA_COMMITTER --ether --rpc-url $BSC_RPC_URL                               # worker gas
```

What good looks like:

- **Funded spins** comfortably above 25, so one full batch cannot lock everyone else out.
- **Seeds** not stuck near zero. The worker commits a fresh batch on its own when they run low.
- **Committer gas** above ~0.002 BNB. Each spin costs it about 0.00003 BNB to reveal and deliver.

---

## Routine operations

**Top up the worker's gas.** Send BNB on BNB Chain to the committer address,
from any wallet.

**Grow the bankroll.** Anyone can call `fund()`. It adds spin capacity and
gives the sender no claim.

```bash
cast send $BACHA_GAME_ADDRESS "fund()" --value 0.05ether \
  --account bacha-admin --rpc-url $BSC_RPC_URL --gas-price 0.1gwei
```

**Take revenue.** `withdrawFees` only releases BNB above every obligation, so
it cannot touch a player's prize or reserve.

```bash
cast call $BACHA_GAME_ADDRESS "withdrawableFees()(uint256)" --rpc-url $BSC_RPC_URL
cast send $BACHA_GAME_ADDRESS "withdrawFees(address,uint256)" $BACHA_ADMIN <wei> \
  --account bacha-admin --rpc-url $BSC_RPC_URL --gas-price 0.1gwei
```

Withdrawing lowers funded spins. Leave enough for at least one full batch.

**Pause.** `pause()` (admin) stops new spins immediately. Pending spins still
settle, deliver and refund.

**Change odds or add a stock.** Add the token with `scripts/add-token.mjs`,
rebalance `scripts/build-machine-config.mjs`, then run `npm run table:export`.
Next, run `Configure.s.sol` to approve any new asset and raise the prize cap
if needed. Finally, run `PublishTable.s.sol`, which publishes a new version and
repoints the tier. Published versions are never edited, so spins in flight
keep the table they were sold against.

---

## Upgrading the game contract

The beacon stays; only the game is replaced. This is the sequence used to move
from `0x3fB3…1b20` to the current game. Run it from `contracts/` with
`.env.launch` loaded.

1. **Test.** Run `forge test`; every suite must pass. Rehearse on an anvil fork
   of mainnet if the change touches settlement or delivery.
2. **Deploy** (deployer). With `BACHA_RANDOMNESS_ADDRESS` set, the script
   reuses the beacon and prints the new `BACHA_GAME_ADDRESS`.
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url $BSC_RPC_URL \
     --account bacha-deployer --sender $DEPLOYER --broadcast --slow --with-gas-price 0.1gwei
   ```
3. **Repoint `.env.launch`.** Set `BACHA_OLD_GAME_ADDRESS` to the current game
   and `BACHA_GAME_ADDRESS` to the new one.
4. **Pause the old game, then configure and publish on the new one** (admin).
   Configure grants the new game beacon access and revokes the old one's,
   approves the table's assets, sets the prize cap and makes the committer
   the settler.
   ```bash
   cast send $BACHA_OLD_GAME_ADDRESS "pause()" --account bacha-admin --rpc-url $BSC_RPC_URL --gas-price 0.1gwei
   forge script script/Configure.s.sol:Configure --rpc-url $BSC_RPC_URL \
     --account bacha-admin --sender $BACHA_ADMIN --broadcast --slow --with-gas-price 0.1gwei
   forge script script/PublishTable.s.sol:PublishTable --rpc-url $BSC_RPC_URL \
     --account bacha-admin --sender $BACHA_ADMIN --broadcast --slow --with-gas-price 0.1gwei
   ```
5. **Move the bankroll** once the old game's `obligations()` is 0.
   ```bash
   cast send $BACHA_OLD_GAME_ADDRESS "withdrawFees(address,uint256)" $BACHA_ADMIN <withdrawableFees> \
     --account bacha-admin --rpc-url $BSC_RPC_URL --gas-price 0.1gwei
   cast send $BACHA_GAME_ADDRESS "fund()" --value <same amount>wei \
     --account bacha-admin --rpc-url $BSC_RPC_URL --gas-price 0.1gwei
   ```
6. **Repoint the services.** Set `BACHA_GAME_ADDRESS` on Railway and
   `NEXT_PUBLIC_BACHA_GAME_ADDRESS` on Vercel. If the ABI changed, run
   `node scripts/export-abi.mjs` and commit.
7. **Ship the site** by pushing to `main`. Vercel only reads the new address on
   a fresh deploy, so update it in step 6 first.
8. **Spin once for real.** Confirm it settles and delivers, then update the
   address tables at the top of this file.

A game deploy is about 3.9M gas, roughly 0.0004 BNB at 0.1 gwei.

---

## Verify on BscScan

The game's constructor is `(admin, randomness, v2Router, v3Router, wbnb)`:

```bash
forge verify-contract $BACHA_GAME_ADDRESS src/BachaGame.sol:BachaGame \
  --chain 56 --etherscan-api-key $BSCSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address)" \
    $BACHA_ADMIN $BACHA_RANDOMNESS_ADDRESS \
    0x10ED43C718714eb63d5aA57B78B54704E256024E \
    0x13f4EA83D0bd40E75C8222255bc855a974568Dd4 \
    0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c)
```

The routers are PancakeSwap's V2 router and V3 SmartRouter; the last address
is WBNB. The fairness page invites players to check the contract, so its
source should be verified.

---

## Web app

```
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_BSC_RPC_URL=<dedicated endpoint; blank uses the public dataseed>
NEXT_PUBLIC_BACHA_GAME_ADDRESS=0xf85b4ae5a43387da702d9b5db368cfa4128f6157
NEXT_PUBLIC_BACHA_RANDOMNESS_ADDRESS=0x3C825aed2854ED84cD8D6683eE9826C13c3e7367
NEXT_PUBLIC_SITE_URL=https://www.bacha.fun
BACHA_GEO_HEADER=x-vercel-ip-country
BACHA_BLOCKED_COUNTRIES=US,PR,GU,VI,AS,MP,UM
```

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is optional. It defaults to Bacha's Reown
project. Leaving the two contract addresses blank runs the site in demo mode,
where every result is labelled *Simulated*.

Build checks: `npm run typecheck && npm run lint && npm test && npm run build`.
Middleware handles locale routing and the geofence, so the app must not be
deployed as a static export.

---

## Security notes

- **Never put a private key behind a `NEXT_PUBLIC_` prefix.** That prefix inlines
  the value into the browser bundle.
- **The committer key is the only hot key.** It lives in Railway's variables.
  At worst it can refuse to reveal (spins refund after 3h) or deliver a prize
  over a worse route, bounded by `minOut`. It can never redirect a prize.
- **Back up the seed store** on the Railway volume. A lost seed orphans its
  commitment, and every spin bound to it must refund. It is also secret until
  revealed.
- **Admin is a single EOA.** Before the bankroll grows much, move
  `DEFAULT_ADMIN` to a multisig.
- **bStocks are issuer-controlled.** Balances rebase for dividends and splits,
  the issuer can blacklist addresses, and US persons must stay geo-blocked.
  Verify any new stock's address against independent sources before adding it.
