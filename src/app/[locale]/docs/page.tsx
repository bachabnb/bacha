import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { ArtImage } from '@/components/brand/ArtImage'
import { machines } from '@/lib/machine'
import { rosterTokens } from '@/lib/machine'
import { registryNotes } from '@/lib/tokens'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.docs' })
  return { title: t('title'), description: t('description') }
}

export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const zh = locale === 'zh-CN'
  const roster = rosterTokens()

  return (
    <article className="shell py-14 lg:py-20">
      <header className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div className="max-w-2xl">
          <span className="eyebrow">{zh ? '文档' : 'Docs'}</span>
          <h1 className="type-hero mt-4 font-display font-extrabold text-foreground">
            {zh ? 'Bacha 是怎么搭的' : 'How Bacha is built'}
          </h1>
          <p className="mt-5 text-[1rem] leading-relaxed text-foreground-secondary">
            {zh
              ? '合约、随机性、金库安全与代币配置——足够你判断这台机器值不值得信。'
              : 'Contracts, randomness, treasury safety and token configuration — enough to judge whether this machine is worth trusting.'}
          </p>
        </div>
        <div className="relative mx-auto lg:sticky lg:top-28">
          <span aria-hidden className="atmosphere-glow pointer-events-none absolute inset-[12%] rounded-full" />
          <div className="relative mx-auto h-[clamp(16rem,34vh,24rem)]">
            <ArtImage
              id="machine-exploded"
              alt=""
              className="mx-auto h-full w-auto"
              sizes="(max-width: 1024px) 32vw, 13vw"
            />
          </div>
        </div>
      </header>

      <div className="mt-16 max-w-2xl space-y-12">
        <Section id="about" title={zh ? '这是什么' : 'What this is'}>
          <p>
            {zh
              ? 'Bacha 把实体扭蛋机的机制原样搬到链上：投币、转盘转动、掉出一个东西。不同之处在于，转盘被换成了一份任何人都能读、也能验证的合约。'
              : 'Bacha takes the mechanism of a physical capsule machine and moves it onchain: pay, the drum turns, something comes out. The difference is that the drum is a contract anyone can read and check.'}
          </p>
        </Section>

        <Section id="contracts" title={zh ? '合约' : 'Contracts'}>
          <p>
            <Code>BachaGame</Code>
            {zh
              ? ' 负责档位、奖池表版本、转动、随机性请求与结算、以及领取。'
              : ' holds tiers, prize-table versions, spins, the randomness request and settlement, and claims.'}
          </p>
          <p>
            <Code>BachaVault</Code>
            {zh
              ? ' 保管奖励库存并执行发放。它不能动用任何已被转动占用的资产——可提取额度等于余额减去全部欠付，欠付由游戏合约计算。'
              : ' custodies reward inventory and performs payouts. It cannot release anything a spin has a claim on: withdrawable equals balance minus everything owed, and the game contract is the single source of that number.'}
          </p>
          <p>
            {zh
              ? 'VRF 回调只写存储——不转账、不调用外部合约、不做无界循环。发放是一个独立的、任何人都能触发的 '
              : 'The VRF callback writes storage and nothing else — no transfers, no external calls, no unbounded loops. Moving the prize is a separate, permissionless '}
            <Code>claimFor(spinId)</Code>
            {zh
              ? '，收款地址在随机数存在之前就已写死，因此结算机器人可以代为触发，却无法改变收款人。'
              : ', whose destination was fixed before randomness existed — so a settlement bot can trigger it on a player’s behalf without being able to redirect anything.'}
          </p>
        </Section>

        <Section id="randomness" title={zh ? '随机性' : 'Randomness'}>
          <p>
            {zh
              ? '生产环境的结果全部来自 Chainlink VRF v2.5。不使用 '
              : 'Production outcomes come from Chainlink VRF v2.5. Never from '}
            <Code>block.timestamp</Code>, <Code>blockhash</Code>, <Code>Math.random()</Code>
            {zh ? '，也不使用任何服务端生成的随机数。' : ', or any server-generated value.'}
          </p>
          <p>
            {zh
              ? '在合约部署之前，结算走的是一个独立的本地模块，与生产路径没有任何共享代码——因此 src/lib/onchain 下的代码永远不可能用服务端生成的随机数去结算一次转动。'
              : 'Until contracts are deployed, settlement runs through a separate local module that shares no code path with the production one — so nothing under src/lib/onchain can ever resolve a spin with a server-generated number.'}
          </p>
          <p>
            <Link href="/fairness" className="text-brand underline decoration-brand-line underline-offset-4">
              {zh ? '在公平性页面自行验证任意一次转动。' : 'Verify any spin yourself on the fairness page.'}
            </Link>
          </p>
        </Section>

        <Section id="treasury" title={zh ? '金库安全' : 'Treasury safety'}>
          <p>
            {zh
              ? 'Bacha 不会产生它付不起的奖励。接受新转动之前，合约会检查金库是否持有足够覆盖最坏情况的每一种资产——即所有在途转动同时命中该资产最大奖项。'
              : 'Bacha never produces a reward it cannot pay. Before accepting a spin, the contract checks the vault holds enough of every asset in the table to cover the worst case on top of everything already owed — that is, every in-flight spin landing on that asset’s largest entry at once.'}
          </p>
          <p>
            {zh
              ? '库存不足时，受影响的机型直接拒绝新转动，已在途的义务不受任何影响。'
              : 'When inventory falls short, the affected machine refuses new spins outright and pending obligations are left untouched.'}
          </p>
        </Section>

        <Section id="tokens" title={zh ? '代币配置' : 'Token configuration'}>
          <p>
            {zh
              ? `当前奖励阵容包含 ${roster.length} 种资产，分布在 ${machines.length} 台机器上。每一种资产在加入前都完成了以下核验：`
              : `The roster holds ${roster.length} assets across ${machines.length} machines. Every one was verified before it was added:`}
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            {registryNotes.slice(1, 5).map((note, i) => (
              <li key={i}>{note.trim()}</li>
            ))}
          </ul>
          <p>
            {zh
              ? '配置内部一律以合约地址为准，从不依赖代号识别代币。跨链封装的其他链资产被刻意排除。'
              : 'Configuration is keyed on contract address throughout — a ticker alone is never enough to identify a token. Bridged representations of other chains’ assets are deliberately excluded.'}
          </p>
        </Section>

        <Section id="faq" title={zh ? '常见问题' : 'FAQ'}>
          <Faq
            q={zh ? '我能赚钱吗？' : 'Can I make money?'}
            a={
              zh
                ? '不保证。多数结果的价值低于转动费用，这是设计使然。把它当游戏，别当收入。'
                : 'There is no guarantee, and most outcomes are worth less than the spin cost by design. Treat it as a game, not an income.'
            }
          />
          <Faq
            q={zh ? '运营方能在我转动后改概率吗？' : 'Can the operator change the odds after I spin?'}
            a={
              zh
                ? '不能。你的转动在付款时就锁定了机型版本与奖池表哈希，已发布版本不可修改。'
                : 'No. Your spin is stamped with a machine version and table hash at payment time, and published versions cannot be edited.'
            }
          />
          <Faq
            q={zh ? '随机数一直没来怎么办？' : 'What if randomness never arrives?'}
            a={
              zh
                ? '超过超时时间后，任何人都可以为这次转动触发退款，转动费用原路退回付款地址。'
                : 'After the timeout, anyone can trigger a refund for that spin and the price returns to the wallet that paid it.'
            }
          />
          <Faq
            q={zh ? '奖励会自动到账吗？' : 'Are rewards sent automatically?'}
            a={
              zh
                ? '领取是独立的一步，任何人都能触发，但收款地址在随机数存在之前就已确定，无法更改。你也可以自己领取。'
                : 'Claiming is a separate, permissionless step — but the recipient was fixed before randomness existed and cannot be changed. You can always claim it yourself.'
            }
          />
        </Section>
      </div>
    </article>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.035em] text-foreground">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-foreground-secondary">{children}</div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="num rounded-[5px] border border-border bg-surface px-1.5 py-0.5 text-[0.85em] text-foreground">
      {children}
    </code>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface p-5">
      <h3 className="text-[0.95rem] font-semibold text-foreground">{q}</h3>
      <p className="mt-2 text-[0.88rem] leading-relaxed text-foreground-secondary">{a}</p>
    </div>
  )
}
