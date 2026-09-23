import { cn } from '@/lib/cn'

/**
 * Shared section opener.
 *
 * The index numeral is an outline so it reads as structure rather than
 * competing with the headline, and it is hidden from assistive tech since it
 * carries no meaning a screen reader needs.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  children,
  action,
  align = 'split',
  className,
}: {
  index?: string
  eyebrow?: string
  title: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  align?: 'split' | 'stack'
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-7',
        align === 'split' && 'md:flex-row md:items-end md:justify-between md:gap-10',
        className,
      )}
    >
      <div className="flex gap-5 md:gap-7">
        {index && (
          <span aria-hidden className="index-numeral hidden shrink-0 text-[3rem] leading-none sm:block md:text-[4rem]">
            {index}
          </span>
        )}
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 className={cn('type-section font-display font-extrabold text-foreground text-balance', eyebrow && 'mt-3')}>
            {title}
          </h2>
          {children && (
            <div className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-foreground-secondary text-pretty">
              {children}
            </div>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
