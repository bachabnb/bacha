import Image from 'next/image'
import { cn } from '@/lib/cn'
import type { RewardToken } from '@/lib/tokens'

/**
 * A token's identity in one element. Falls back to a monogram if a logo file
 * is ever missing, so the roster never renders a broken tile.
 */
export function TokenMark({
  token,
  size = 44,
  className,
  ring = true,
}: {
  token: Pick<RewardToken, 'symbol' | 'logo' | 'name'>
  size?: number
  className?: string
  ring?: boolean
}) {
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-raised',
        ring && 'ring-1 ring-white/10',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {token.logo ? (
        <Image
          src={token.logo}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : (
        <span
          className="font-display font-bold text-foreground-secondary"
          style={{ fontSize: size * 0.38 }}
        >
          {token.symbol.slice(0, 2)}
        </span>
      )}
    </span>
  )
}
