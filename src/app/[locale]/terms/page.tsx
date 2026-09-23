import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Capsule } from '@/components/brand/Capsule'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta.terms' })
  return { title: t('title'), description: t('description') }
}

/**
 * Terms and risk.
 *
 * Deliberately short and specific. It states what Bacha is, what it does not
 * promise, and where the operator's discretion ends — and it makes no claim
 * about where the product is or is not permitted, because that is not
 * something this page can know.
 */
export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const zh = locale === 'zh-CN'

  return (
    <article className="shell py-14 lg:py-20">
      <header className="max-w-2xl">
        <Capsule finish="graphite" size={48} />
        <h1 className="type-hero mt-6 font-display font-extrabold text-foreground">
          {zh ? '条款与风险' : 'Terms & Risk'}
        </h1>
        <p className="mt-5 text-[1rem] leading-relaxed text-foreground-secondary">
          {zh
            ? 'Bacha 是一款结果随机的链上游戏。开始之前，请先读完这一页。'
            : 'Bacha is an onchain game with randomised outcomes. Read this page before you spin.'}
        </p>
      </header>

      <div className="mt-14 max-w-2xl space-y-12">
        <Section id="what" title={zh ? 'Bacha 是什么' : 'What Bacha is'}>
          {zh ? (
            <>
              <p>
                Bacha 是一台运行在 BNB Smart Chain 上的扭蛋机。你支付固定价格转动一次，
                合约按公开的加权奖池表选出恰好一个奖项，并把对应数量的 BEP-20 代币记在你的地址名下。
              </p>
              <p>
                它是一款游戏，也是一种认识 BNB Chain 生态代币的方式。它不是投资产品，
                不是理财产品，也不提供任何形式的收益承诺。
              </p>
            </>
          ) : (
            <>
              <p>
                Bacha is a capsule machine that runs on BNB Smart Chain. You pay a fixed price for
                one spin, the contract selects exactly one prize from a published weighted table,
                and a fixed quantity of a BEP-20 token is recorded against your address.
              </p>
              <p>
                It is a game, and a way to meet tokens from the BNB Chain ecosystem. It is not an
                investment product, not a financial product, and it makes no promise of return.
              </p>
            </>
          )}
        </Section>

        <Section id="risk" title={zh ? '风险提示' : 'Risk notice'}>
          {zh ? (
            <>
              <p>
                <strong className="text-foreground">一次转动并不保证盈利。</strong>
                多数结果的市场价值低于你支付的金额——这是设计如此，而不是意外。
              </p>
              <p>
                奖励是代币，价值随市场波动，可能大幅下跌，也可能归零。奖池表锁定的是代币
                <em>数量</em>，不是美元金额；界面上的美元估算仅供参考，不参与结算。
              </p>
              <p>
                部分奖励代币的链上流动性较薄，意味着你未必能按显示价格卖出。
                只投入你可以承受全部损失的金额。
              </p>
            </>
          ) : (
            <>
              <p>
                <strong className="text-foreground">A spin does not guarantee a profit.</strong> Most
                outcomes are worth less than what you paid. That is how the machine is designed, not
                a fault in it.
              </p>
              <p>
                Rewards are tokens. Their value moves with the market, can fall sharply, and can
                reach zero. A prize table fixes a token <em>quantity</em>, never a dollar amount —
                the USD figures in the interface are indicative only and take no part in settlement.
              </p>
              <p>
                Some reward assets have thin onchain liquidity, which means you may not be able to
                sell at the price shown. Only spend what you can afford to lose entirely.
              </p>
            </>
          )}
        </Section>

        <Section id="fairness" title={zh ? '结果如何产生' : 'How results are produced'}>
          {zh ? (
            <>
              <p>
                结果由 Chainlink VRF 提供的可验证随机数决定。你付款的那一刻，本次转动就被打上
                机型版本号与奖池表哈希；已发布的版本不可修改，运营方事后调整概率也影响不到
                已经在途的转动。
              </p>
              <p>完整说明与自助验证工具见公平性页面。</p>
            </>
          ) : (
            <>
              <p>
                Outcomes come from verifiable randomness supplied by Chainlink VRF. The moment you
                pay, your spin is stamped with a machine version and the hash of that version&apos;s
                prize table. Published versions cannot be edited, so an operator changing odds
                afterwards cannot reach a spin already in flight.
              </p>
              <p>The fairness page explains this in full and lets you check any spin yourself.</p>
            </>
          )}
        </Section>

        <Section id="responsible" title={zh ? '理性游玩' : 'Responsible use'}>
          {zh ? (
            <>
              <p>
                你需要年满 18 周岁。付费随机奖励在不同司法辖区受到的监管并不相同，
                确认当地规定是你自己的责任——本站不对任何地区的合法性作出表述。
              </p>
              <p>
                如果你在追回损失、或者转动的花费超出了计划，请停下来。这是一款游戏，
                不是收入来源。
              </p>
            </>
          ) : (
            <>
              <p>
                You must be 18 or older. Paid randomised prizes are regulated differently depending
                on where you are, and confirming what applies to you is your responsibility — this
                site makes no representation about legality in any jurisdiction.
              </p>
              <p>
                If you are chasing a loss, or spending more than you planned, stop. This is a game,
                not an income.
              </p>
            </>
          )}
        </Section>

        <Section id="independence" title={zh ? '独立性' : 'Independence'}>
          {zh ? (
            <p>
              Bacha 是一个独立项目。它并非由 BNB Chain、币安，或本站提及的任何代币发行方运营、
              背书或赞助。所有代币名称与标识均归各自项目所有，此处仅用于标明奖励内容。
            </p>
          ) : (
            <p>
              Bacha is an independent project. It is not operated, endorsed or sponsored by BNB
              Chain, Binance, or any token issuer named on this site. All token names and marks
              belong to their respective projects and are used here only to identify what a reward
              consists of.
            </p>
          )}
        </Section>
      </div>
    </article>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.035em] text-foreground">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[0.95rem] leading-relaxed text-foreground-secondary">
        {children}
      </div>
    </section>
  )
}
