import { cn } from '@/lib/cn'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="font-display text-[1.8rem] font-extrabold tracking-[-0.04em] text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[0.9rem] leading-relaxed text-foreground-secondary">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function Card({
  title,
  children,
  className,
  footer,
}: {
  title?: string
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
}) {
  return (
    <section className={cn('panel overflow-hidden', className)}>
      {title && (
        <header className="border-b border-border px-5 py-3.5">
          <h2 className="text-[0.66rem] uppercase tracking-[0.16em] text-foreground-muted">{title}</h2>
        </header>
      )}
      <div className="p-5">{children}</div>
      {footer && <footer className="border-t border-border px-5 py-3.5">{footer}</footer>}
    </section>
  )
}

export function StatusPill({ status }: { status: 'HEALTHY' | 'LOW' | 'PAUSED' | 'UNFUNDED' }) {
  const styles = {
    HEALTHY: 'border-success/35 bg-success-soft text-success',
    LOW: 'border-warning/35 bg-warning-soft text-warning',
    PAUSED: 'border-border-strong bg-surface-hover text-foreground-muted',
    UNFUNDED: 'border-danger/35 bg-danger-soft text-danger',
  } as const

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em]',
        styles[status],
      )}
    >
      <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
      {status}
    </span>
  )
}

export function Metric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  tone?: 'default' | 'brand' | 'danger'
}) {
  return (
    <div className="min-w-0">
      <div className="text-[0.62rem] uppercase tracking-[0.15em] text-foreground-muted">{label}</div>
      <div
        className={cn(
          'num mt-1.5 font-display text-[1.5rem] font-extrabold tracking-[-0.04em]',
          tone === 'brand' && 'text-brand',
          tone === 'danger' && 'text-danger',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[0.7rem] text-foreground-muted">{hint}</div>}
    </div>
  )
}

export function EmptyNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[12px] border border-dashed border-border-strong px-5 py-10 text-center">
      <p className="text-[0.9rem] text-foreground-secondary">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[0.8rem] leading-relaxed text-foreground-muted">{body}</p>
    </div>
  )
}
