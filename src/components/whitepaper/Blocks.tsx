import { getTranslations } from 'next-intl/server'
import { ArtImage } from '@/components/brand/ArtImage'
import { CodeBlock } from './CodeBlock'
import { LivePanel } from './LivePanel'
import { hasArt, type ArtId } from '@/lib/art'
import { cn } from '@/lib/cn'
import type { Block, CalloutKind } from '@/content/whitepaper/types'

/**
 * Renders a chapter's blocks.
 *
 * Server-rendered apart from the code listing's copy control, so the whole
 * paper is in the initial HTML — it has to be readable, printable and
 * indexable without JavaScript.
 */
export async function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  )
}

async function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case 'p':
      return <p className="wp-block wp-p">{block.text}</p>

    case 'h3':
      return <h3 className="wp-block wp-h3">{block.text}</h3>

    case 'ul':
      return (
        <ul className="wp-block wp-list">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )

    case 'ol':
      return (
        <ol className="wp-block wp-list wp-list-ordered">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      )

    case 'callout':
      return <Callout kind={block.kind} title={block.title} text={block.text} />

    case 'code':
      return <CodeBlock code={block.code} caption={block.caption} />

    case 'table':
      return (
        <figure className="wp-block">
          <div className="overflow-x-auto rounded-[14px] border border-border">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {block.head.map((head) => (
                    <th
                      key={head}
                      className="px-4 py-3 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-foreground-muted"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0 align-top">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className={cn(
                          'px-4 py-3.5 text-[0.84rem] leading-relaxed',
                          j === 0 ? 'font-medium text-foreground' : 'text-foreground-secondary',
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && (
            <figcaption className="mt-2 text-[0.76rem] text-foreground-muted">
              {block.caption}
            </figcaption>
          )}
        </figure>
      )

    case 'facts':
      return (
        <dl className="wp-block grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-2">
          {block.items.map((item) => (
            <div key={item.label} className="bg-surface px-4 py-3.5">
              <dt className="text-[0.78rem] font-semibold text-foreground">{item.label}</dt>
              <dd className="mt-1 text-[0.82rem] leading-relaxed text-foreground-secondary">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )

    case 'flow':
      return (
        <ol className="wp-block wp-flow">
          {block.steps.map((step, i) => (
            <li key={i} className="wp-flow-step">
              <span className="block text-[0.82rem] font-semibold text-foreground">
                {step.label}
              </span>
              {step.detail && (
                <span className="mt-0.5 block text-[0.74rem] leading-snug text-foreground-muted">
                  {step.detail}
                </span>
              )}
            </li>
          ))}
        </ol>
      )

    case 'steps':
      return (
        <ol className="wp-block grid gap-px overflow-hidden rounded-[14px] border border-border bg-border">
          {block.items.map((item) => (
            <li key={item.n} className="bg-surface px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex items-baseline gap-4">
                <span className="num shrink-0 text-[0.7rem] font-medium text-brand">{item.n}</span>
                <h4 className="font-display text-[1.02rem] font-bold tracking-[-0.02em] text-foreground">
                  {item.title}
                </h4>
              </div>
              <p className="mt-1.5 pl-[2.2rem] text-[0.86rem] leading-relaxed text-foreground-secondary">
                {item.body}
              </p>
              {item.technical && (
                <p className="num mt-2.5 ml-[2.2rem] rounded-[10px] border border-border bg-background px-3.5 py-2.5 text-[0.74rem] leading-relaxed text-foreground-muted">
                  {item.technical}
                </p>
              )}
            </li>
          ))}
        </ol>
      )

    case 'art': {
      const id = block.id as ArtId
      if (!hasArt(id)) return null
      return (
        <figure
          className={cn(
            'wp-block mx-auto',
            block.width === 'wide' ? 'max-w-[26rem]' : 'max-w-[13rem]',
          )}
        >
          <ArtImage
            id={id}
            alt={block.alt}
            sizes={block.width === 'wide' ? '(max-width: 768px) 80vw, 26rem' : '13rem'}
          />
        </figure>
      )
    }

    case 'live':
      return <LivePanel kind={block.kind} />
  }
}

/* --------------------------------------------------------------- callouts */

const CALLOUT_TONE: Record<CalloutKind, string> = {
  note: 'border-border bg-surface',
  important: 'border-brand-line bg-brand-soft',
  security: 'border-border-strong bg-surface-raised',
  demo: 'border-warning/30 bg-warning-soft',
  formula: 'border-border bg-surface-raised',
  onchain: 'border-success/25 bg-success-soft',
  risk: 'border-warning/30 bg-warning-soft',
}

async function Callout({
  kind,
  title,
  text,
}: {
  kind: CalloutKind
  title?: string
  text: string
}) {
  const t = await getTranslations('whitepaper.callout')

  return (
    <aside className={cn('wp-block rounded-[14px] border px-5 py-4', CALLOUT_TONE[kind])}>
      <p className="text-[0.58rem] font-medium uppercase tracking-[0.18em] text-foreground-muted">
        {t(kind)}
      </p>
      {title && <p className="mt-2 text-[0.92rem] font-semibold text-foreground">{title}</p>}
      <p
        className={cn(
          'text-[0.86rem] leading-relaxed text-foreground-secondary',
          title ? 'mt-1.5' : 'mt-2',
          // A formula is the content, not commentary — give it the mono face.
          kind === 'formula' && 'num text-[0.84rem] text-foreground',
        )}
      >
        {text}
      </p>
    </aside>
  )
}
