import { cn } from '@/lib/cn'

export function Stat({
  label,
  value,
  hint,
  className,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  className?: string
  tone?: 'default' | 'bnb' | 'muted'
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[0.66rem] uppercase tracking-[0.18em] text-foreground-secondary">{label}</div>
      <div
        className={cn(
          'mt-1.5 truncate font-display text-[1.05rem] font-bold tracking-[-0.03em]',
          tone === 'bnb' && 'text-brand',
          tone === 'muted' && 'text-foreground-secondary',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-[0.72rem] text-foreground-secondary">{hint}</div>}
    </div>
  )
}
