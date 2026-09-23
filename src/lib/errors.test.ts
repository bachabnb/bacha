import { describe, it, expect } from 'vitest'
import { errorKey, isUserRejection } from './errors'

/**
 * Raw provider errors must never reach a person. These pin the mapping from
 * what a wallet or node actually throws to the message we show.
 */
describe('error mapping', () => {
  const cases: [string, string][] = [
    ['User rejected the request.', 'userRejected'],
    ['MetaMask Tx Signature: User denied transaction signature.', 'userRejected'],
    ['ACTION_REJECTED', 'userRejected'],
    ['insufficient funds for gas * price + value', 'insufficientFunds'],
    ['execution reverted: IncorrectPayment(1, 2)', 'priceChanged'],
    ['execution reverted: InsufficientInventory', 'outOfInventory'],
    ['execution reverted: TierInactive(0)', 'tierInactive'],
    ['execution reverted: EnforcedPause()', 'paused'],
    ['execution reverted: SpinNotSettled(4, 1)', 'notSettled'],
    ['execution reverted: UnknownSpin(99)', 'unknownSpin'],
    ['execution reverted: RefundTooEarly(4, 123)', 'refundTooEarly'],
    ['nonce too low', 'pendingTx'],
    ['chain mismatch', 'wrongChain'],
    ['request timed out', 'timeout'],
    ['fetch failed', 'network'],
    ['429 rate limit exceeded', 'rateLimit'],
  ]

  it.each(cases)('maps %s', (message, expected) => {
    expect(errorKey(new Error(message))).toBe(expected)
  })

  it('falls back to a generic message rather than leaking internals', () => {
    const raw = 'TypeError: Cannot read properties of undefined (reading "0x...") at Provider.send'
    expect(errorKey(new Error(raw))).toBe('generic')
  })

  it('handles non-Error values without throwing', () => {
    expect(errorKey(undefined)).toBe('generic')
    expect(errorKey(null)).toBe('generic')
    expect(errorKey('user rejected')).toBe('userRejected')
    expect(errorKey({ weird: true })).toBe('generic')
  })

  it('separates a cancellation from a fault', () => {
    expect(isUserRejection(new Error('User rejected the request.'))).toBe(true)
    expect(isUserRejection(new Error('insufficient funds'))).toBe(false)
    expect(isUserRejection(undefined)).toBe(false)
  })
})
