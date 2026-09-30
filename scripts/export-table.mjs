#!/usr/bin/env node
/**
 * Exports data/machine.json as the table file PublishTable.s.sol reads.
 *
 * One file per run, covering every machine: the prizes of the first machine
 * and a tier entry for each. PublishTable publishes a single version, so every
 * machine exported together must share one prize list — this refuses to write
 * a file that would silently drop a machine's prizes.
 *
 *   node scripts/export-table.mjs [out]    default: contracts/tables/bacha.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const out = process.argv[2] ?? 'contracts/tables/bacha.json'
const { machines } = JSON.parse(await readFile('data/machine.json', 'utf8'))

if (!machines?.length) throw new Error('data/machine.json has no machines')

const prizesOf = (m) =>
  m.prizes.map((p) => ({ token: p.token, amount: p.amountUnits, weight: p.weight, rarity: p.rarity }))

const prizes = prizesOf(machines[0])
for (const m of machines.slice(1)) {
  if (JSON.stringify(prizesOf(m)) !== JSON.stringify(prizes)) {
    throw new Error(`machine "${m.id}" has its own prize list; export it to a separate file`)
  }
}

for (const p of prizes) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(p.token)) throw new Error(`bad token address ${p.token}`)
  if (!/^[1-9][0-9]*$/.test(p.amount)) throw new Error(`amount must be base units: ${p.amount}`)
  if (!(p.rarity >= 0 && p.rarity <= 3)) throw new Error(`bad rarity ${p.rarity}`)
}

const table = {
  prizes,
  tiers: machines.map((m) => ({ id: m.tierId, label: m.label, price: m.priceWei })),
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(table, null, 2) + '\n')

const totalWeight = prizes.reduce((s, p) => s + p.weight, 0)
console.log(`wrote ${out}: ${prizes.length} prizes, total weight ${totalWeight}, ${table.tiers.length} tier(s)`)
