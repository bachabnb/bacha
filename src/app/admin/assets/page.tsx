import { PageHeader, Card } from '@/components/admin/AdminPrimitives'
import { TokenMark } from '@/components/ui/TokenMark'
import { allTokens, registryNotes } from '@/lib/tokens'
import { explorer } from '@/lib/chain'
import { shortAddress, formatUsd } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Reward assets are configuration, not code: enabling or disabling one is a
 * change to `data/tokens.json` plus a vault approval, never an edit to a
 * component. This page is the read side of that, with the verification trail
 * for each entry.
 */
export default function AdminAssets() {
  return (
    <>
      <PageHeader
        title="Reward assets"
        description="Every asset the machine is allowed to hold. Adding one means verifying its contract address against independent sources, approving it on the vault, then including it in a published prize table."
      />

      <Card title="Verification policy" className="mb-4">
        <ul className="space-y-1.5 text-[0.82rem] leading-relaxed text-foreground-secondary">
          {registryNotes.slice(1).map((note, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-brand" />
              {note.trim()}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-[0.82rem]">
            <thead>
              <tr className="text-[0.6rem] uppercase tracking-[0.14em] text-foreground-muted">
                <th className="pb-3 font-normal">Asset</th>
                <th className="pb-3 font-normal">Address</th>
                <th className="pb-3 font-normal">Decimals</th>
                <th className="pb-3 font-normal">Category</th>
                <th className="pb-3 text-right font-normal">Liquidity</th>
                <th className="pb-3 text-right font-normal">Verified</th>
                <th className="pb-3 text-right font-normal">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {allTokens.map((token) => (
                <tr key={token.address} className="border-t border-border align-top">
                  <td className="py-3">
                    <span className="flex items-center gap-2.5">
                      <TokenMark token={token} size={26} />
                      <span>
                        <span className="num block font-medium text-foreground">{token.symbol}</span>
                        <span className="block text-[0.72rem] text-foreground-muted">{token.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="num py-3">
                    <a
                      href={explorer.token(token.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground-secondary underline decoration-border underline-offset-4 hover:text-foreground"
                    >
                      {shortAddress(token.address, 6, 6)}
                    </a>
                  </td>
                  <td className="num py-3 text-foreground-secondary">{token.decimals}</td>
                  <td className="py-3 text-foreground-secondary">{token.category}</td>
                  <td className="num py-3 text-right text-foreground-secondary">
                    {token.liquidityUsd != null ? formatUsd(token.liquidityUsd) : '—'}
                  </td>
                  <td className="num py-3 text-right text-foreground-muted">{token.verifiedAt}</td>
                  <td className="py-3 text-right">
                    <span
                      className={
                        token.rewardEnabled
                          ? 'num text-[0.74rem] text-success'
                          : 'num text-[0.74rem] text-foreground-muted'
                      }
                    >
                      {token.rewardEnabled ? 'yes' : 'no'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-4 max-w-3xl text-[0.78rem] leading-relaxed text-foreground-muted">
        Assets flagged with transfer notes need care: BABYDOGE uses 9 decimals and has a
        fee-on-transfer history, which is why the vault credits the measured balance delta rather
        than the requested amount. LISTA has thin on-DEX liquidity, so its prize amounts are kept
        small.
      </p>
    </>
  )
}
