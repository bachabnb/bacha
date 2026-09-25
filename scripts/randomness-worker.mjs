#!/usr/bin/env node
/**
 * The Bacha randomness worker.
 *
 * Two jobs, both against `BachaRandomness`:
 *
 *   1. COMMIT — keep the beacon stocked with seed commitments. A spin reverts
 *      with `NoCommitmentAvailable` when the queue runs dry, so the machine
 *      stops selling rather than selling a spin it cannot settle.
 *
 *   2. REVEAL — open the committed seed for each request once its reveal block
 *      has been mined, which settles the spin.
 *
 * WHY THE SEED FILE MATTERS
 *
 * A commitment is `keccak256(abi.encode(seed))`. If the seed is lost, that
 * commitment can never be opened and every spin bound to it must be refunded
 * through the timeout path. The seed store is therefore the one piece of
 * operational state that must be durable and backed up. It is also secret
 * until revealed: anyone holding it early knows outcomes early.
 *
 *   BACHA_SEED_STORE   path to the seed store (default .secrets/seeds.json)
 *
 * Seeds are 32 bytes from the platform CSPRNG and are never reused — a
 * repeated seed would let anyone predict a later spin from an earlier reveal.
 *
 * Environment:
 *   BACHA_RPC_URL                 RPC endpoint
 *   BACHA_RANDOMNESS_ADDRESS      the beacon
 *   BACHA_COMMITTER_KEY           hot key holding COMMITTER_ROLE (gas only)
 *   BACHA_COMMIT_BATCH            seeds per commit batch (default 128)
 *   BACHA_COMMIT_LOW_WATER        top up below this many unused (default 64)
 *   BACHA_POLL_MS                 loop interval (default 4000)
 *
 * Usage:
 *   node scripts/randomness-worker.mjs          # run the loop
 *   node scripts/randomness-worker.mjs --once   # one pass, then exit
 *   node scripts/randomness-worker.mjs --commit-only
 */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  keccak256,
  getAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bsc, bscTestnet } from 'viem/chains'

const argv = new Set(process.argv.slice(2))
const ONCE = argv.has('--once')
const COMMIT_ONLY = argv.has('--commit-only')

const RPC = process.env.BACHA_RPC_URL
const BEACON = process.env.BACHA_RANDOMNESS_ADDRESS
const KEY = process.env.BACHA_COMMITTER_KEY
const STORE = process.env.BACHA_SEED_STORE ?? '.secrets/seeds.json'
const BATCH = Number(process.env.BACHA_COMMIT_BATCH ?? 128)
const LOW_WATER = Number(process.env.BACHA_COMMIT_LOW_WATER ?? 64)
const POLL_MS = Number(process.env.BACHA_POLL_MS ?? 4000)

if (!RPC || !BEACON || !KEY) {
  console.error(
    'missing environment: BACHA_RPC_URL, BACHA_RANDOMNESS_ADDRESS and BACHA_COMMITTER_KEY are all required',
  )
  process.exit(1)
}

const abi = [
  { type: 'function', name: 'commit', stateMutability: 'nonpayable', inputs: [{ name: 'hashes', type: 'bytes32[]' }], outputs: [] },
  { type: 'function', name: 'reveal', stateMutability: 'nonpayable', inputs: [{ name: 'requestId', type: 'uint256' }, { name: 'seed', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'availableCommitments', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'commitmentCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'requestCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'revealable', stateMutability: 'view', inputs: [{ name: 'requestId', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function',
    name: 'getRequest',
    stateMutability: 'view',
    inputs: [{ name: 'requestId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'consumer', type: 'address' },
          { name: 'commitmentIndex', type: 'uint64' },
          { name: 'revealBlock', type: 'uint64' },
          { name: 'revealed', type: 'bool' },
          { name: 'delivered', type: 'bool' },
          { name: 'seed', type: 'bytes32' },
          { name: 'word', type: 'uint256' },
        ],
      },
    ],
  },
]

const account = privateKeyToAccount(KEY.startsWith('0x') ? KEY : `0x${KEY}`)
const address = getAddress(BEACON)

const publicClient = createPublicClient({ transport: http(RPC) })
const chainId = await publicClient.getChainId()
const chain = chainId === 97 ? bscTestnet : bsc
const wallet = createWalletClient({ account, chain, transport: http(RPC) })

const read = (functionName, args = []) => publicClient.readContract({ address, abi, functionName, args })

async function send(functionName, args) {
  const { request } = await publicClient.simulateContract({ address, abi, functionName, args, account })
  const hash = await wallet.writeContract(request)
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

/* ----------------------------------------------------------- seed store */

/**
 * Seeds indexed by commitment index, which is what a request points at.
 * Written atomically: a half-written store would orphan commitments as surely
 * as a lost one.
 */
async function loadStore() {
  try {
    const raw = await readFile(STORE, 'utf8')
    const parsed = JSON.parse(raw)
    return { seeds: parsed.seeds ?? {}, committed: parsed.committed ?? 0 }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return { seeds: {}, committed: 0 }
  }
}

async function saveStore(store) {
  await mkdir(path.dirname(STORE), { recursive: true })
  const tmp = `${STORE}.tmp`
  await writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 })
  await rename(tmp, STORE)
}

const commitmentOf = (seed) => keccak256(encodeAbiParameters([{ type: 'bytes32' }], [seed]))

/* --------------------------------------------------------------- commit */

async function topUp(store) {
  const available = await read('availableCommitments')
  if (available >= BigInt(LOW_WATER)) return false

  const startIndex = Number(await read('commitmentCount'))
  const seeds = []
  const hashes = []
  for (let i = 0; i < BATCH; i++) {
    const seed = `0x${randomBytes(32).toString('hex')}`
    seeds.push(seed)
    hashes.push(commitmentOf(seed))
  }

  // Persist BEFORE committing. A seed on chain whose preimage was never
  // written to disk is unopenable; a seed on disk that was never committed is
  // merely unused.
  for (let i = 0; i < seeds.length; i++) store.seeds[startIndex + i] = seeds[i]
  await saveStore(store)

  const hash = await send('commit', [hashes])
  store.committed = startIndex + seeds.length
  await saveStore(store)

  console.log(`committed ${seeds.length} seeds from index ${startIndex} (available was ${available}) ${hash}`)
  return true
}

/* --------------------------------------------------------------- reveal */

async function revealPending(store, cursor) {
  const total = Number(await read('requestCount'))
  let revealed = 0

  for (let id = cursor.next; id <= total; id++) {
    const req = await read('getRequest', [BigInt(id)])
    if (req.consumer === '0x0000000000000000000000000000000000000000') continue

    if (req.revealed) {
      if (id === cursor.next) cursor.next = id + 1
      continue
    }

    if (!(await read('revealable', [BigInt(id)]))) {
      // Either the reveal block is not mined yet — come back next tick — or
      // it has aged out of the 256-block window and this request can never be
      // settled. The spin falls through to the game's refund path.
      const block = await publicClient.getBlockNumber()
      if (block > req.revealBlock + 256n) {
        console.warn(`request ${id} aged out of the blockhash window — spin must be refunded`)
        if (id === cursor.next) cursor.next = id + 1
      }
      continue
    }

    const seed = store.seeds[String(req.commitmentIndex)]
    if (!seed) {
      console.error(`request ${id} uses commitment ${req.commitmentIndex} and its seed is NOT in the store`)
      continue
    }

    try {
      const hash = await send('reveal', [BigInt(id), seed])
      revealed++
      console.log(`revealed request ${id} (commitment ${req.commitmentIndex}) ${hash}`)
      if (id === cursor.next) cursor.next = id + 1
    } catch (err) {
      console.error(`reveal failed for request ${id}: ${err.shortMessage ?? err.message}`)
    }
  }

  return revealed
}

/* ----------------------------------------------------------------- loop */

const store = await loadStore()
const cursor = { next: 1 }

console.log(`beacon    ${address}`)
console.log(`committer ${account.address}`)
console.log(`chain     ${chainId}`)
console.log(`store     ${STORE} (${Object.keys(store.seeds).length} seeds)`)

async function tick() {
  try {
    await topUp(store)
    if (!COMMIT_ONLY) await revealPending(store, cursor)
  } catch (err) {
    console.error(`tick failed: ${err.shortMessage ?? err.message}`)
  }
}

await tick()
if (!ONCE && !COMMIT_ONLY) {
  setInterval(tick, POLL_MS)
} else {
  process.exit(0)
}
