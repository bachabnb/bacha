# Bacha

An onchain gacha game for tokenized stocks on BNB Chain.

You pay a fixed price for one spin, the contract picks exactly one reward from
a prize table that was frozen the moment you paid, and a commit–reveal beacon
decides which one. The odds are published, the result can be recomputed by
anyone from public inputs, and it is permanently recorded.

**Built on BNB Smart Chain.** Bacha is an independent project and is not
operated, endorsed or sponsored by BNB Chain, Binance, or any token issuer
named in it.

---

## What it does

```
connect  →  choose a machine  →  pay  →  randomness settles  →  claim
```

One machine, one price (0.0026 BNB, about $2). Every reward is a fraction of a
tokenized US stock — a bStock, issued on BNB Chain by BTECH Holdings and backed
1:1 by shares in custody. The odds are 68% common, 23% uncommon, 8% rare and 1%
epic, and the prize table is authored in `scripts/build-machine-config.mjs`.

---

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no contract addresses configured the app runs in **demo mode**: spins are
simulated server-side, every result is labelled *Simulated* wherever it appears,
and no transaction is made. Demo randomness lives in its own module
(`src/lib/demo/`) and shares no code path with real settlement.

### Contracts

```bash
cd contracts
forge test        # 81 tests, including 6 invariants
forge build
```

---

## How it is put together

| | |
|---|---|
| **App** | Next.js 15 (App Router), React 19, TypeScript, Tailwind v4 |
| **Wallet** | wagmi + viem, injected + WalletConnect |
| **i18n** | next-intl, locale-prefixed routes (`/en`, `/zh-CN`) |
| **Contracts** | Solidity 0.8.28, OpenZeppelin v5, Foundry |
| **Randomness** | `BachaRandomness` — first-party commit–reveal beacon |
| **Art** | OpenAI Images, generated once at build time |

### Layout

```
src/
  app/[locale]/       public pages, one tree per locale
  app/admin/          operator console, outside the locale tree
  components/
    brand/            logo, capsule, machine, generated-art wrapper
    play/             the game: stage, console, result, states
    home/ rewards/ activity/ fairness/ me/
  lib/
    machine.ts        prize tables + the weighted walk
    tokens.ts         the verified token registry
    demo/             DEMO ONLY settlement. Never on the production path.
    onchain/          contract reads
    spin/useSpin.ts   the spin lifecycle, both modes
contracts/            BachaGame, BachaVault, tests, deploy scripts
data/                 token registry, prize tables, image credits
art-masters/          unoptimised generation masters (not served)
messages/             en.json, zh-CN.json
```

---

## The parts that matter

### Odds cannot move under a spin

`spin()` stamps each spin with a `versionId` and the hash of that version's
prize table. Published versions are append-only — there is no function in
`BachaGame` that can edit one — so an operator publishing new odds mid-flight
cannot reach a spin already in the air. There is a test for exactly this
(`test_pendingSpinKeepsItsOriginalPrizeTable`).

### The machine never owes more than it holds

Before accepting a spin, the contract checks the vault holds enough of **every**
asset in the table to cover the worst case for that spin on top of everything
already owed — that is, every pending spin landing on the same asset's largest
entry at once. When inventory falls short the machine refuses new spins and
leaves pending obligations untouched. This is enforced by an invariant, not
just a unit test.

### The randomness callback cannot fail

`rawFulfillRandomWords` writes storage and nothing else: no transfers, no external
calls, no unbounded loops. Moving the prize is a separate, permissionless
`claimFor(spinId)` whose destination was fixed before randomness existed — so a
settlement bot can trigger it on a player's behalf without taking custody or
being able to redirect anything. Players can always claim themselves.

### Prices never touch settlement

A prize table fixes a **token quantity**. Every dollar figure in the interface
is decoration computed from a cached third-party feed, and when that feed fails
prices are hidden rather than guessed. The contract has no price oracle.

### Tokens are identified by address

`data/tokens.json` holds the roster. Every entry is added with
`node scripts/add-token.mjs <dexscreener link>`, which resolves the link to the
token, reads `name()`, `symbol()`, `decimals()` and `totalSupply()` straight
from BNB Smart Chain, and refuses any contract that does not delegate to the
bStocks issuer beacon — a copied ticker is easy, a copied issuer is not. There
is deliberately no `tokenBySymbol`: a ticker is not an identifier.

bStocks must not be offered to US persons, their balances rebase for dividends
and splits, and the issuer can block addresses. Set `BACHA_BLOCKED_COUNTRIES`
accordingly before launch.

---

## Commands

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | frontend tests (84) |
| `npm run contracts:test` | Foundry tests (81) |
| `npm run art:generate` | generate the art pack (needs `OPENAI_API_KEY`) |
| `npm run art:optimize` | trim, resize and convert to WebP |
| `npm run logo:process` | prepare `public/brand/bacha-logo.png` for the web |
| `npm run tokens:verify` | re-check the token registry against live sources |

---

## Art and media

All artwork is generated for this project by `scripts/generate-bacha-art.mjs`
from a single shared style base, so twenty renders read as one hardware
universe. **No prompt requests text or logos** — real token marks and all copy
are composited in HTML, which keeps them accurate and translatable.

Generation is a build-time content pipeline. It is never called from a request
path, and `OPENAI_API_KEY` is server-side only.

There is **no stock photography** anywhere in the product. Every photographic
asset was replaced with generated isometric artwork; a photograph broke the
premise that every object on the page belongs to one manufacturer.

The BNB Chain mark is used nominatively to identify the chain. Provenance for
everything shipped is recorded in `data/image-credits.json`.

The app runs with no art pack at all — every consumer falls back to its CSS/SVG
treatment.

---

## Safety and compliance

Bacha handles real money, so:

- no seed phrases are ever requested, and nothing is signed server-side for a user
- raw RPC errors never reach the interface
- the operator console is disabled unless `BACHA_ADMIN_TOKEN` is set, and it
  cannot sign anything — every state change is executed by an operator wallet
  and checked by the contract
- a single entry gate confirms age and acceptance once, rather than scattering
  warnings across the product
- `BACHA_BLOCKED_COUNTRIES` gates requests in middleware, before a page that
  takes money is reached

Paid randomised prizes with transferable value are regulated differently across
jurisdictions. Bacha makes no claim about where it is permitted; see
`/terms`.

**Reward values can change. A spin does not guarantee a profit.**

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Licence

Unreleased. All rights reserved.
