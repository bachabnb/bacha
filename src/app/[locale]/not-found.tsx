import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/Button'
import { Capsule } from '@/components/brand/Capsule'

export default async function NotFound() {
  const t = await getTranslations('errors')

  return (
    <div className="shell flex flex-col items-center py-32 text-center">
      <Capsule finish="graphite" size={72} />
      <h1 className="type-section mt-10 font-display font-extrabold text-foreground">{t('notFound')}</h1>
      <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed text-foreground-secondary">
        {t('notFoundBody')}
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/">{t('backHome')}</Link>
      </Button>
    </div>
  )
}
