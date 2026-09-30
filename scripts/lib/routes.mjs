/**
 * Best-price routing from BNB into a token across PancakeSwap V2 and V3.
 *
 * Quoting V2 alone is not safe: measured against the roster, some pools had
 * almost no V2 depth and would fill far above market, while the same tokens
 * fill at market on V3. Several also route better through USDT than against
 * WBNB directly, so both hops are tried at every fee tier.
 *
 * A route that just failed can be excluded by label, so a retry falls back to
 * the next-best pool instead of the one that is misbehaving.
 */
import { encodePacked, getAddress } from 'viem'

export const WBNB = getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')
export const USDT = getAddress('0x55d398326f99059fF775485246999027B3197955')
export const V2_ROUTER = getAddress('0x10ED43C718714eb63d5aA57B78B54704E256024E')
export const V3_QUOTER = getAddress('0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997')
export const V3_FEES = [100, 500, 2500, 10000]

const v2RouterAbi = [
  { type: 'function', name: 'getAmountsOut', stateMutability: 'view', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], outputs: [{ type: 'uint256[]' }] },
]
const v3QuoterAbi = [
  {
    type: 'function', name: 'quoteExactInput', stateMutability: 'nonpayable',
    inputs: [{ name: 'path', type: 'bytes' }, { name: 'amountIn', type: 'uint256' }],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
]

/**
 * @returns {Promise<null | { kind: 'v2' | 'v3', path: `0x${string}`[] | `0x${string}`, out: bigint, label: string }>}
 *   For v2, `path` is an address array; for v3, a packed path.
 */
export async function bestRoute(client, token, amountIn, { exclude = new Set() } = {}) {
  token = getAddress(token)
  let best = null
  const keep = (candidate) => {
    if (exclude.has(candidate.label)) return
    if (candidate.out > 0n && (!best || candidate.out > best.out)) best = candidate
  }

  for (const path of [[WBNB, token], [WBNB, USDT, token]]) {
    try {
      const amounts = await client.readContract({
        address: V2_ROUTER, abi: v2RouterAbi, functionName: 'getAmountsOut', args: [amountIn, path],
      })
      keep({ kind: 'v2', path, out: amounts[amounts.length - 1], label: path.length === 2 ? 'V2' : 'V2 via USDT' })
    } catch {
      // No pool on this route.
    }
  }

  const quoteV3 = async (path, label) => {
    try {
      // QuoterV2 is non-view by design (it reverts internally to measure), so
      // it has to be simulated rather than read.
      const { result } = await client.simulateContract({
        address: V3_QUOTER, abi: v3QuoterAbi, functionName: 'quoteExactInput', args: [path, amountIn],
      })
      keep({ kind: 'v3', path, out: result[0], label })
    } catch {
      // Pool does not exist at this fee tier.
    }
  }

  for (const fee of V3_FEES) {
    await quoteV3(encodePacked(['address', 'uint24', 'address'], [WBNB, fee, token]), `V3 ${fee / 10000}%`)
    for (const fee2 of V3_FEES) {
      await quoteV3(
        encodePacked(['address', 'uint24', 'address', 'uint24', 'address'], [WBNB, fee, USDT, fee2, token]),
        `V3 ${fee / 10000}% via USDT ${fee2 / 10000}%`,
      )
    }
  }

  return best
}

/** The game's `Route` struct for a route from `bestRoute`. */
export function toGameRoute(route) {
  return route.kind === 'v2'
    ? { kind: 0, path: route.path, v3Path: '0x' }
    : { kind: 1, path: [], v3Path: route.path }
}
