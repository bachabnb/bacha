import { Capsule } from '@/components/brand/Capsule'

export const dynamic = 'force-static'

export default function Unavailable() {
  return (
    <main className="shell flex min-h-dvh flex-col items-center justify-center py-24 text-center">
      <Capsule finish="graphite" size={72} />
      <h1 className="type-section mt-10 font-display font-extrabold text-foreground">
        Bacha is not available in your region.
      </h1>
      <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-foreground-secondary">
        Access from your location is restricted, so spins cannot be offered here.
      </p>
      <p lang="zh-CN" className="mt-6 max-w-md text-[0.9rem] leading-relaxed text-foreground-muted">
        Bacha 在你所在的地区不可用。由于访问受限，这里无法提供转动服务。
      </p>
    </main>
  )
}
