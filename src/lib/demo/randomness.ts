import 'server-only'
import { randomBytes } from 'node:crypto'

/**
 * ────────────────────────────────────────────────────────────────────────
 *  DEMO RANDOMNESS — NOT A PRODUCTION SETTLEMENT PATH
 * ────────────────────────────────────────────────────────────────────────
 *
 * This exists so the product is explorable before contracts are deployed.
 * It is deliberately isolated in `src/lib/demo/` and is imported by exactly
 * one place: the demo spin store. Nothing under `src/lib/onchain/` may import
 * it, and no mainnet outcome is ever produced here.
 *
 * Real outcomes come from `BachaRandomness` via `BachaGame.rawFulfillRandomWords`.
 * A result produced by this function is always tagged `mode: 'demo'` and is
 * labelled as simulated everywhere it is shown.
 */
export function demoRandomWord(): bigint {
  // A CSPRNG, so demo results are at least not predictable in a dev session.
  // It is still server-generated, which is exactly why it must never settle
  // anything of value.
  return BigInt('0x' + randomBytes(32).toString('hex'))
}

export const DEMO_RANDOMNESS_NOTICE =
  'Simulated locally with a server CSPRNG. Not the onchain beacon, not an onchain result.'
