'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

/**
 * A code listing with a copy control.
 *
 * Deliberately unhighlighted. The listings here are short and are read for
 * their logic, not skimmed for syntax, and a tokeniser would add a dependency
 * plus a second theme to keep in sync with the design tokens for no gain.
 */
export function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  const t = useTranslations('whitepaper')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // Clipboard access can be denied outright; the code is selectable anyway.
    }
  }, [code])

  return (
    <figure className="wp-block wp-code">
      <div className="relative overflow-hidden rounded-[12px] border border-border bg-surface-raised">
        <button
          type="button"
          onClick={copy}
          className="num absolute right-2.5 top-2.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[0.68rem] font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground print:hidden"
        >
          {copied ? t('copied') : t('copy')}
        </button>
        <pre className="num overflow-x-auto px-5 py-4 pr-20 text-[0.78rem] leading-relaxed text-foreground-secondary">
          <code>{code}</code>
        </pre>
      </div>
      {caption && (
        <figcaption className="mt-2 text-[0.76rem] text-foreground-muted">{caption}</figcaption>
      )}
    </figure>
  )
}
