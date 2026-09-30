import 'server-only'
import { unstable_cache } from 'next/cache'
import { formatEther } from 'viem'
import { publicClient, gameAddress } from './client'
import { bachaGameAbi } from '../contracts/abis'
import {
  machines as configMachines,
  serializeMachine,
  deserializeMachine,
  type Machine,
  type SerializedMachine,
  bnbUsdOf,
} from '../machine'
import { getMarketSnapshot, quoteFor } from '../market'
import { tokenByAddress } from '../tokens'
import { rarityFromIndex } from '../rarity'
import { spinMode } from '../env'

/**
 * The machines as the contract currently sells them.
 *
 * `data/machine.json` supplies what the chain does not hold — tagline, display
 * copy, reference prices — and the chain supplies everything a spin actually
 * resolves against: the tier's price, whether it is active, and the prize
 * table of the version the tier points at. The solvency governor republishes
 * tables with rescaled amounts, and an operator can reprice a tier; either way
 * the page shows what a spin will be charged and paid, not what the config
 * file said at build time.
 *
 * Falls back to the config when the chain cannot be read, and says so via
 * `source`, so a stale table is never presented as the live one.
 */
export async function getLiveMachines(): Promise<Machine[]> {
  if (spinMode !== 'onchain' || !gameAddress) return configMachines
  const serialized = await readCached()
  return serialized.map(deserializeMachine)
}

/** Same data, still serialized — for handing to client components. */
export async function getLiveMachinesSerialized(): Promise<SerializedMachine[]> {
  if (spinMode !== 'onchain' || !gameAddress) return configMachines.map(serializeMachine)
  return readCached()
}

const readCached = unstable_cache(
  async (): Promise<SerializedMachine[]> => {
    try {
      return (await Promise.all(configMachines.map(overlay))).map(serializeMachine)
    } catch {
      return configMachines.map((m) => serializeMachine({ ...m, source: 'config' }))
    }
  },
  ['bacha-live-machines'],
  { revalidate: 30 },
)

async function overlay(local: Machine): Promise<Machine> {
  const game = gameAddress!
  const tier = await publicClient
    .readContract({ address: game, abi: bachaGameAbi, functionName: 'getTier', args: [local.tierId] })
    .catch(() => null)

  // A tier the contract has never configured cannot be spun at all.
  if (!tier) return { ...local, active: false, source: 'onchain', versionId: null }

  const [version, prizes] = await publicClient.readContract({
    address: game,
    abi: bachaGameAbi,
    functionName: 'getVersion',
    args: [tier.versionId],
  })

  const bnbUsd = bnbUsdOf(local)
  const market = await getMarketSnapshot().catch(() => null)
  const localByToken = new Map(local.prizes.map((p) => [p.token.toLowerCase(), p]))
  const livePrizes = prizes.map((p) => {
    const token = tokenByAddress(p.token)
    const ref = localByToken.get(p.token.toLowerCase())
    const valueBnb = Number(formatEther(p.value))
    const valueUsd = valueBnb * bnbUsd
    // Shares the value buys: live price if the feed has one, else the price
    // the table was authored at. Display only — the swap decides.
    const sharePrice =
      (market ? quoteFor(market, p.token)?.priceUsd : null) ??
      (ref && ref.amount > 0 ? ref.referenceValueUsd / ref.amount : null)
    return {
      tokenId: token?.id ?? ref?.tokenId ?? '',
      token: p.token,
      symbol: token?.symbol ?? ref?.symbol ?? '?',
      decimals: token?.decimals ?? ref?.decimals ?? 18,
      valueWei: p.value.toString(),
      valueBnb,
      amount: sharePrice ? Number((valueUsd / sharePrice).toPrecision(3)) : 0,
      weight: p.weight,
      rarity: rarityFromIndex(p.rarity),
      referenceValueUsd: valueUsd,
      token_: token,
    }
  })

  const totalWeight = version.totalWeight
  const rarityShare = [0, 1, 2, 3].map(
    (r) => prizes.filter((p) => p.rarity === r).reduce((s, p) => s + p.weight, 0) / totalWeight,
  )
  const expectedValueUsd = livePrizes.reduce((s, p) => s + (p.referenceValueUsd * p.weight) / totalWeight, 0)
  const priceBnb = Number(formatEther(tier.price))

  return {
    ...local,
    label: tier.label || local.label,
    priceWei: tier.price,
    priceBnb,
    referencePriceUsd: priceBnb * bnbUsd,
    totalWeight,
    localTableHash: version.prizeTableHash,
    rarityShare,
    expectedValueUsd,
    referenceReturnToPlayer: priceBnb * bnbUsd > 0 ? expectedValueUsd / (priceBnb * bnbUsd) : 0,
    prizes: livePrizes,
    active: tier.active,
    source: 'onchain',
    versionId: tier.versionId.toString(),
  }
}
