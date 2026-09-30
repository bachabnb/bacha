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
              ? '合约、随机性、资金池安全与代币配置——足够你判断这台机器值不值得信。'
              : 'Contracts, randomness, bankroll safety and token configuration — enough to judge whether this machine is worth trusting.'}
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
          <p>
            {/* This page is the short answer; the paper is the long one. */}
            <Link
              href="/whitepaper"
              className="text-brand underline decoration-brand-line underline-offset-4"
            >
              {zh ? '阅读白皮书 →' : 'Read the whitepaper →'}
            </Link>
          </p>
        </Section>

        <Section id="contracts" title={zh ? '合约' : 'Contracts'}>
          <p>
            <Code>BachaGame</Code>
            {zh
              ? ' 负责档位、奖池表版本、转动、随机性请求与结算、BNB 资金池，以及奖品发放。'
              : ' holds tiers, prize-table versions, spins, the randomness request and settlement, the BNB bankroll, and prize delivery.'}
          </p>
          <p>
            {zh
              ? '没有单独的金库。游戏合约只持有 BNB，每份奖品都是一个固定的 BNB 价值。已欠付的部分无法被提走：可提取额度等于余额减去在途转动的预留额与已结算未发放的奖品价值。'
              : 'There is no separate vault. The game holds only BNB, and every prize is a fixed BNB value. Nothing owed can be withdrawn: withdrawable equals balance minus the reserve behind every pending spin and the value of every settled, undelivered prize.'}
          </p>
          <p>
            {zh
              ? '随机数回调只写存储——不转账、不兑换、不调用外部合约、不做无界循环。买入奖品是独立的一步 '
              : 'The randomness callback writes storage and nothing else — no transfers, no swaps, no external calls, no unbounded loops. Buying the prize is a separate step, '}
            <Code>deliver(spinId, route, minOut, deadline)</Code>
            {zh
              ? '：它在 PancakeSwap 上把奖品的 BNB 价值兑换成对应股票，直接发到玩家钱包。结算机器人持有 SETTLER_ROLE，可以代玩家调用，但只能选择兑换路径与最低输出——代币、金额与收款人都由合约锁定，合约还会检查路径以 WBNB 开头、以奖品代币结尾，且只经过已批准的中转代币。玩家也可以改用 '
              : ', which swaps the prize’s BNB value into the stock on PancakeSwap, straight to the player. The settlement bot holds SETTLER_ROLE and can call it on a player’s behalf, but it only picks the route and the minimum output: the contract fixes the token, the amount and the recipient, and checks that the route starts at WBNB, ends at the prize token and uses only approved hops. A player can instead take the prize in BNB with '}
            <Code>payInBnb(spinId)</Code>
            {zh ? ' 直接领取 BNB。' : '.'}
          </p>
        </Section>

        <Section id="randomness" title={zh ? '随机性' : 'Randomness'}>
          <p>
            {zh
              ? '生产环境的结果来自 Bacha 自己的承诺—揭示信标：运营方先公布种子的哈希，抽取发生之后才揭示。不使用 '
              : "Production outcomes come from Bacha's own commit–reveal beacon: the operator publishes a seed's hash first and only opens it after the spin exists. Never from "}
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

        <Section id="treasury" title={zh ? '资金池安全' : 'Bankroll safety'}>
          <p>
            {zh
              ? 'Bacha 不会承诺它付不起的奖品。每次在途转动都会预留其奖池表最大奖与自身付款两者中的较大值；每份已结算未发放的奖品都按全额计为欠付；只有 BNB 余额足以覆盖全部这些时，合约才接受新的转动。'
              : 'Bacha never promises a prize it cannot pay. Every pending spin reserves the larger of its table’s biggest prize and its own payment; every settled, undelivered prize is owed in full; and a new spin is refused unless the BNB balance covers all of it.'}
          </p>
          <p>
            {zh
              ? '资金池不足时，受影响的机型直接拒绝新转动，已在途的义务不受任何影响。由于奖品以 BNB 价值计，支付率由奖池表固定——代币价格涨跌不会让机器资不抵债，也就不需要任何机制去重新调整。'
              : 'When the bankroll falls short, the affected machine refuses new spins outright and pending obligations are left untouched. Because prizes are BNB values, the payout rate is fixed by the table — token prices moving cannot make the machine insolvent, so nothing needs to rescale it.'}
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
                ? '结算机器人可以在转动结算后替你发放奖品——把它的 BNB 价值兑换成对应股票并发到你的钱包。它只能选择兑换路径，永远无法改变代币、金额或收款人。你也始终可以自己发放，或改为直接领取 BNB。'
                : 'A settlement bot can deliver your prize once the spin settles — swapping its BNB value into the stock and sending it to your wallet. It chooses only the route, never the token, the amount or the recipient. You can always deliver it yourself, or take the prize in BNB instead.'
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
