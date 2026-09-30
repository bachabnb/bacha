# Launching Bacha on BNB Chain with a $100 float

The step-by-step for the first mainnet launch. DEPLOYMENT.md explains *why*
each piece exists; this file is the exact order to run it in, sized for a
budget of about $100.

Every command that signs is run **by you, in your own terminal**. No private
key is ever written to a file in this repo or pasted anywhere else — the
deploy scripts sign with an encrypted Foundry keystore (`--account`) or a
Ledger (`--ledger`).

---

## The numbers

Prices from 2026-09-30 (BNB $763.60). Gas on BNB Chain was 0.05 gwei;
commands below pay 0.1 gwei so they are never stuck.

| | |
|---|---|
| Spin price | 0.0026 BNB ≈ **$1.99** |
| Expected payout per spin | ≈ $1.23 (RTP ≈ 62%) |
| Odds | 68% common · 23% uncommon · 8% rare · 1% epic |
| Inventory one pending spin ties up | ≈ $13.58 |
| Inventory stocked | 5 concurrent spins ≈ $68 |
| Deploy, all three contracts | ≈ 0.0003 BNB ($0.23) — measured |
| Admin setup + publish | ≈ 0.0001 BNB ($0.06) — measured |
| One reveal (per spin) | ≈ 0.00002 BNB ($0.02) |

"5 concurrent spins" is a burst limit, not a volume limit: a spin settles in
seconds, and the treasury worker restocks from spin revenue.

**The most you can lose is what you deposit.** The contract refuses any spin
it could not pay in full, so the machine stops rather than owing. What can
shrink the float is the reward tokens themselves falling in price while they
sit in the vault — they are small-cap tokens and can move fast.

### Where the $100 goes

| Wallet | Role | Hot / cold | Send |
|---|---|---|---|
| `bacha-deployer` | deploys, then holds nothing | cold, used once | 0.001 BNB |
| `bacha-admin` | owns every contract | **cold** — Ledger if you have one | 0.002 BNB |
| `bacha-committer` | commits and reveals randomness | hot, on the worker machine | 0.004 BNB |
| `bacha-operator` | solvency governor (retunes prize sizes) | hot, on the worker machine | 0.001 BNB |
| `bacha-treasury` | buys prize tokens, restocks the vault | hot, on the worker machine | 0.115 BNB |
| | | **total** | **0.123 BNB ≈ $94** |

The committer is the only wallet that is not refilled automatically: at
0.004 BNB it covers roughly 150 spins' reveals. Top it up by hand as it runs
down (`cast balance` below).

---

## Before you start

- [ ] Paid random prizes are regulated differently across jurisdictions. Check
      where you can operate, and set `BACHA_BLOCKED_COUNTRIES` for the rest.
- [ ] A small always-on Linux server for the three workers (Step 6). If the
      randomness worker is down for more than ~3 minutes, spins in flight
      can't settle and are refunded after 3 hours — no money is lost, but
      players wait.
- [ ] An RPC endpoint for BNB Chain. The public `https://bsc-dataseed.bnbchain.org`
      is fine for deploying; the workers poll, so give them a free-tier key
      from a provider.
- [ ] Foundry installed (`forge --version`) and Node 20+.

```bash
git checkout deploy-readiness
npm ci
cd contracts
forge install --no-git foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0
forge test          # 81 tests must pass
cd ..
```

---

## Step 1 — Create the wallets

Each command creates an encrypted keystore, asks you for a password, and
prints only the address. Use a different strong password for each.

```bash
mkdir -p ~/.foundry/keystores
cast wallet new ~/.foundry/keystores bacha-deployer
cast wallet new ~/.foundry/keystores bacha-admin        # skip if the admin is a Ledger
cast wallet new ~/.foundry/keystores bacha-committer
cast wallet new ~/.foundry/keystores bacha-operator
cast wallet new ~/.foundry/keystores bacha-treasury
cast wallet list                                        # confirm all five
```

Write the five **addresses** down (addresses are public; that's fine). Back
up `~/.foundry/keystores` and the passwords somewhere offline. Lose the admin
keystore and nobody can ever change the machine again.

Create `contracts/.env.launch` (gitignored) with the public values only —
`scripts/create-wallets.sh` writes it for you. Load it with
`set -a && source .env.launch && set +a`: a plain `source` does not export the
values, and forge would stop with "environment variable not found".

```bash
# contracts/.env.launch — public values only, never a private key
BSC_RPC_URL=https://bsc-dataseed.bnbchain.org
DEPLOYER=0x...           # bacha-deployer address
BACHA_ADMIN=0x...        # bacha-admin address (or your Ledger address)
BACHA_COMMITTER=0x...    # bacha-committer address
BACHA_TREASURY=0x...     # bacha-treasury address
BACHA_OPERATOR=0x...     # bacha-operator address
BACHA_TABLE_FILE=./tables/bacha.json
```

---

## Step 2 — Fund the wallets

Buy about **0.125 BNB** and withdraw it to your deployer address on
**BNB Smart Chain (BEP-20)** — not opBNB, not the old Beacon Chain. Then send
the amounts from the table above to each wallet (MetaMask is fine for this).

Check before continuing:

```bash
cd contracts && set -a && source .env.launch && set +a
for a in $DEPLOYER $BACHA_ADMIN $BACHA_COMMITTER $BACHA_OPERATOR $BACHA_TREASURY; do
  echo "$a $(cast balance $a --ether --rpc-url $BSC_RPC_URL)"
done
```

---

## Step 3 — Deploy the contracts

Dry run first — this simulates against mainnet and sends nothing:

```bash
cd contracts && set -a && source .env.launch && set +a
forge script script/Deploy.s.sol:Deploy --rpc-url $BSC_RPC_URL \
  --account bacha-deployer --sender $DEPLOYER
```

It should print the deployer, admin, committer and `chain id 56`. If those
are right, broadcast:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url $BSC_RPC_URL \
  --account bacha-deployer --sender $DEPLOYER \
  --broadcast --slow --with-gas-price 0.1gwei
```

Copy the three printed addresses into `.env.launch`:

```bash
BACHA_VAULT_ADDRESS=0x...
BACHA_GAME_ADDRESS=0x...
BACHA_RANDOMNESS_ADDRESS=0x...
```

Confirm the deployer kept nothing and the admin holds everything:

```bash
set -a && source .env.launch && set +a
ADMIN_ROLE=0x0000000000000000000000000000000000000000000000000000000000000000
for c in $BACHA_GAME_ADDRESS $BACHA_VAULT_ADDRESS $BACHA_RANDOMNESS_ADDRESS; do
  echo "$c admin=$(cast call $c 'hasRole(bytes32,address)(bool)' $ADMIN_ROLE $BACHA_ADMIN --rpc-url $BSC_RPC_URL) \
deployer=$(cast call $c 'hasRole(bytes32,address)(bool)' $ADMIN_ROLE $DEPLOYER --rpc-url $BSC_RPC_URL)"
done
# expect admin=true deployer=false on all three
```

---

## Step 4 — Configure (admin)

Sets a prize ceiling per asset (2× its largest prize — the limit a stolen
operator key can never cross) and grants the treasury and operator their
roles. With a Ledger, replace `--account bacha-admin` with `--ledger`.

```bash
forge script script/Configure.s.sol:Configure --rpc-url $BSC_RPC_URL \
  --account bacha-admin --sender $BACHA_ADMIN \
  --broadcast --slow --with-gas-price 0.1gwei
```

---

## Step 5 — Publish the prize table (admin)

```bash
forge script script/PublishTable.s.sol:PublishTable --rpc-url $BSC_RPC_URL \
  --account bacha-admin --sender $BACHA_ADMIN \
  --broadcast --slow --with-gas-price 0.1gwei
```

Expect `published version 1`, `total weight 10000`, `tiers activated 1` and
`funded spins left 0`. Zero is correct — the vault is empty, so every spin is
refused until Step 7.

---

## Step 6 — Set up the worker server

The three workers run on a small always-on Linux server (about $4–6 a month:
any provider's smallest Ubuntu 24.04 machine with 1–2 GB of memory). Only the
**committer, treasury and operator** wallets ever go there — never the admin
or deployer, and never your password.

1. Create an **Ubuntu 24.04** server with your provider, choosing SSH-key
   login and pasting your Mac's public key (`cat ~/.ssh/id_ed25519.pub`).
   Note its IP address.

2. On the server (`ssh root@<SERVER_IP>`), run the setup. It installs Node and
   Foundry, creates a `bacha` system user, downloads the code to `/opt/bacha`
   and installs the three services without starting them:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/bachabnb/bacha/deploy-readiness/scripts/server/setup.sh | bash
   ```

3. From your **Mac**, in the `BACHA` folder, copy the three worker wallets
   and the public launch settings across:

   ```bash
   ssh root@<SERVER_IP> 'install -d -m 700 /root/keystores'
   scp ~/.foundry/keystores/bacha-{committer,treasury,operator} root@<SERVER_IP>:/root/keystores/
   scp contracts/.env.launch root@<SERVER_IP>:/etc/bacha/launch.env
   ```

4. Back on the **server**, unlock them once. It asks for your wallet
   password, checks each key matches its address, stores the keys where only
   root can read them, and deletes the copied wallet files:

   ```bash
   bash /opt/bacha/scripts/server/install-keys.sh
   ```

Worker settings live in `/etc/bacha/worker.env` (sized for the $100 float).
Replace `BACHA_RPC_URL` there with a provider endpoint when you have one.

---

## Step 7 — Start the randomness worker

```bash
systemctl enable --now bacha-randomness
journalctl -u bacha-randomness -f       # Ctrl+C to stop watching
```

Expect `committed 64 seeds from index 0`. It keeps the queue topped up and
reveals every spin from then on, and restarts itself after a crash or reboot.

**Back up the seed store** from your Mac, now and regularly — a lost seed can
never be revealed, and until it is revealed it predicts that spin:

```bash
scp root@<SERVER_IP>:/var/lib/bacha/seeds.json ~/bacha-seeds-backup.json
```

---

## Step 8 — Stock the vault, then start the treasury and governor

Read-only first — best route and price per stock, and what it would buy:

```bash
bash /opt/bacha/scripts/server/run.sh treasury --quote
bash /opt/bacha/scripts/server/run.sh treasury --once
```

One real purchase pass, capped at 0.02 BNB. Check the transactions on
BscScan before going further:

```bash
bash /opt/bacha/scripts/server/run.sh treasury --live --once
```

Then leave both running. The treasury buys 0.02 BNB at a time until five
spins are covered, then restocks from spin revenue; the governor keeps the
payout between 55% and 70%:

```bash
systemctl enable --now bacha-treasury bacha-governor
bash /opt/bacha/scripts/server/status.sh
```

Stocked when `funded spins` reads 5 or more.

---

## Step 9 — One real spin, end to end

Point a local copy of the site at mainnet (`.env.local`):

```
NEXT_PUBLIC_CHAIN_ID=56
NEXT_PUBLIC_BACHA_GAME_ADDRESS=0x...
NEXT_PUBLIC_BACHA_VAULT_ADDRESS=0x...
NEXT_PUBLIC_BACHA_RANDOMNESS_ADDRESS=0x...
```

`npm run dev`, connect a personal wallet with ~0.005 BNB, spin once, and
check: the demo ribbon is gone, the console says **Healthy**, the spin
settles within seconds, **Claim** delivers the token, and `/fairness`
re-derives it as matched.

---

## Step 10 — Verify the source on BscScan

The fairness page invites people to check the contracts; unverified bytecode
makes that hollow. Verification commands are in DEPLOYMENT.md ("Verify on
BscScan"). If an Etherscan API key is refused for BNB Chain on your plan,
BscScan's web form (*Verify & Publish → Standard JSON*) is free.

---

## Keeping it running

On the server:

```bash
bash /opt/bacha/scripts/server/status.sh          # services, gas, seeds, funded spins
journalctl -u bacha-treasury --since today       # any worker's log
```

After a change is pushed to `deploy-readiness`, update the server by running
the Step 6 setup command again, then `systemctl restart bacha-randomness
bacha-treasury bacha-governor`.

From your Mac:

```bash
# committer gas — top up below ~0.001 BNB
cast balance $BACHA_COMMITTER --ether --rpc-url $BSC_RPC_URL
# spins the vault can still cover
cast call $BACHA_GAME_ADDRESS 'remainingFundedSpins(uint64)(uint256)' 1 --rpc-url $BSC_RPC_URL
# stop new spins immediately (admin); pending spins still settle and stay claimable
cast send $BACHA_GAME_ADDRESS 'pause()' --account bacha-admin --rpc-url $BSC_RPC_URL --with-gas-price 0.1gwei
```
