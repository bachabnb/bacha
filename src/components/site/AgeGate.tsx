'use client'

import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { Capsule } from '@/components/brand/Capsule'

const KEY = 'bacha:acknowledged'

/**
 * A single, quiet gate rather than warnings scattered across the product.
 *
 * Confirms age and acceptance once, then gets out of the way. Jurisdiction
 * blocking is a separate, server-side concern — see `BACHA_BLOCKED_COUNTRIES`
 * and the middleware hook — because a client-side check is not a control.
 */
export function AgeGate() {
  const t = useTranslations('ageGate')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) !== 'yes') setOpen(true)
    } catch {
      // Storage blocked — don't trap someone behind a gate we cannot record.
    }
  }, [])

  function accept() {
    try {
      window.localStorage.setItem(KEY, 'yes')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-background/92 backdrop-blur-md" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[61] w-[min(29rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 panel-raised p-7 focus:outline-none"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <Capsule finish="bnb" size={44} />
          <Dialog.Title className="mt-5 font-display text-2xl font-bold tracking-[-0.035em] text-foreground">
            {t('title')}
          </Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-3 space-y-3 text-[0.86rem] leading-relaxed text-foreground-secondary">
              <p>{t('bodyOne')}</p>
              <p>{t('bodyTwo')}</p>
            </div>
          </Dialog.Description>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={accept}>
              {t('accept')}
            </Button>
            <Button asChild variant="secondary" className="flex-1">
              <Link href="/terms">{t('readTerms')}</Link>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
