import type { WhitepaperContent } from './types'

/**
 * Bacha 白皮书 — 简体中文。
 *
 * 与英文版遵循同一套规则：
 *   - 未部署的内容不会被描述为已部署。
 *   - 不声称已完成审计，因为尚未进行。
 *   - Bacha 没有代币，因此全文不提及。
 *   - 此处列出的每一项安全属性，合约都已实现。
 *
 * 章节 id 与 index 必须与英文版保持一致：深链接与目录共用同一套锚点。
 * 代码块、合约函数名与事件名保持英文原样——它们是标识符，不是文案。
 */
export const zhCN: WhitepaperContent = {
  version: '1.0',
  title: '拆开这台机器。',
  subtitle:
    '关于 Bacha 在 BNB Smart Chain 上的机器架构、奖励体系、随机数、储备金、公开概率与结算模型的技术说明。',

  chapters: [
    {
      id: 'abstract',
      index: '00',
      title: '摘要',
      blocks: [
        {
          t: 'p',
          text: 'Bacha 是一款运行在 BNB Smart Chain 上的扭蛋机奖励游戏。玩家选择一台机器，按固定价格支付一次抽取费用，并从公开的奖品配置中获得恰好一份奖励。',
        },
        {
          t: 'p',
          text: '整套设计围绕五项性质展开：概率在付款之前就已公布；每一次抽取都会记录下当时售出它的机器配置；随机数来自运营方之外；奖励由合约在收款前核验过的库存兜底；结算的每一步都记录在任何人都能读取的地方。',
        },
        {
          t: 'callout',
          kind: 'important',
          text: 'Bacha 是一款游戏，也是一种代币发现机制。它不是投资产品，不承诺任何回报。按照设计，大多数结果的价值低于一次抽取的成本。',
        },
      ],
    },

    {
      id: 'what-is-bacha',
      index: '01',
      title: 'Bacha 是什么？',
      lede: '把实体扭蛋机的机制搬到链上。',
      blocks: [
        {
          t: 'flow',
          steps: [
            { label: '玩家', detail: '支付固定价格' },
            { label: '机器', detail: '锁定奖品表' },
            { label: '随机数', detail: '返回一个数字' },
            { label: '奖励', detail: '一条记录在案的条目' },
          ],
        },
        {
          t: 'p',
          text: '扭蛋机五十年来的工作方式没有变过。你投币，转盘转动，掉出一样东西。你得到什么，由机械的偶然性在一组固定内容上决定。',
        },
        {
          t: 'p',
          text: 'Bacha 保留了这套机制，只是把转盘换成了合约。内容变成一张由 BEP-20 资产组成、权重公开的奖品表。机械的偶然性变成一个并非由运营方生成的随机数。结果则从手里的塑料壳，变成一条永久记录。',
        },
        { t: 'h3', text: 'Bacha 是' },
        {
          t: 'ul',
          items: [
            '一款付费游戏，结果随机，一次一抽。',
            '一种获得 BNB Chain 原生项目少量资产的方式。',
            '一套概率、随机数与结算都可供任何人查验的系统。',
          ],
        },
        { t: 'h3', text: 'Bacha 不是' },
        {
          t: 'ul',
          items: [
            '投资产品、收益机制或收入来源。',
            '对「一次抽取的价值高于其成本」的任何承诺。',
            '拥有自有代币的协议——Bacha 没有代币，本文档也未规划任何代币。',
          ],
        },
      ],
    },

    {
      id: 'design-principles',
      index: '02',
      title: '设计原则',
      lede: '架构所围绕的五项承诺。',
      blocks: [
        {
          t: 'steps',
          items: [
            {
              n: '01',
              title: '公开',
              body: '概率在付款之前即可见，并由合约所持有的同一组权重计算得出。界面不保留第二份可能与之偏离的概率数据。',
            },
            {
              n: '02',
              title: '版本化',
              body: '每次抽取都会记录付款当时生效的机器配置。此后调整概率只会创建新版本，不会改写已有的抽取记录。',
            },
            {
              n: '03',
              title: '可验证',
              body: '随机数、它所对应的奖品表以及最终奖励全部记录在链上。任何人都可以重算一遍，得到同样的答案。',
            },
            {
              n: '04',
              title: '有储备',
              body: '合约在接受一次抽取之前，会先确认自己能够承担最坏情况；若不能，则拒绝这次抽取。',
            },
            {
              n: '05',
              title: '简单',
              body: '玩家的体验始终只有三步：连接、抽取、揭晓。以上所有机制都藏在这三步之后，不会变成玩家的负担。',
            },
          ],
        },
      ],
    },

    {
      id: 'architecture',
      index: '03',
      title: '机器架构',
      lede: '四个系统，一台机器。',
      blocks: [
        { t: 'art', id: 'machine-exploded', alt: 'Bacha 机器的爆炸视图。', width: 'narrow' },
        {
          t: 'table',
          head: ['模块', '职责', '输入', '输出'],
          rows: [
            ['游戏合约', '抽取请求、机器版本、随机数生命周期、结果', '付款、档位', '记录在案的抽取与结果'],
            ['金库', '奖励库存、储备记账、支付', '注资、支付指令', '已转出的奖励'],
            ['随机数', '每次抽取一个不可预测的数字，来自已承诺的种子', '请求', '随机数'],
            ['代币登记表', '哪些资产可用，以及它们的准确身份', '经核验的配置', '地址、精度、元数据'],
          ],
        },
        {
          t: 'callout',
          kind: 'onchain',
          title: '职责分离',
          text: '金库对「应该付给谁」不持任何意见。它只暴露一个供游戏合约调用的支付接口，并拒绝释放任何已被某次抽取占用的资产。游戏合约是「欠了什么」的唯一事实来源，因此不存在第二份可能与之偏离的账目。',
        },
      ],
    },

    {
      id: 'spin-lifecycle',
      index: '04',
      title: '一次抽取的生命周期',
      lede: '从付款到发放，共八步。',
      blocks: [
        {
          t: 'steps',
          items: [
            {
              n: '01',
              title: '玩家选择机器',
              body: '每台机器是一个档位，拥有各自的价格与各自的奖品表。',
              technical: '档位以 { exists, active, price, versionId, label } 存储，通过 getTier(uint8) 读取。',
            },
            {
              n: '02',
              title: '提交付款',
              body: '抽取价格以 BNB 支付，金额必须完全一致。',
              technical: 'spin(uint8 tierId) 为 payable；当 msg.value 与档位价格不符时以 IncorrectPayment 回滚。该函数带有 nonReentrant 与 whenNotPaused。',
            },
            {
              n: '03',
              title: '锁定机器版本',
              body: '该次抽取会被打上机器版本号，以及该版本奖品表的哈希。',
              technical: '在请求随机数之前，versionId 与 prizeTableHash 已连同 player、tier、payment 与 requestedAt 一并写入 Spin 结构体。',
            },
            {
              n: '04',
              title: '请求随机数',
              body: '该次抽取取用下一个已承诺的种子，并被告知由哪个未来区块封定结果。',
              technical: '信标消耗其 FIFO 承诺队列并返回 requestId，映射到 spin id。请求同时记录一个位于数个区块之后的 revealBlock。',
            },
            {
              n: '05',
              title: '随机数返回',
              body: '该区块被挖出后，种子被打开、随机数被送达。在此之前，这次抽取保持待定状态。',
              technical: '回调只写存储，不做别的——没有转账、没有外部调用、没有无界循环。对同一请求的重复投递会被忽略而非回滚，因此重试不会卡死队列。',
            },
            {
              n: '06',
              title: '选中奖品序号',
              body: '该数字在已冻结的加权表上行走，恰好落在一个条目上。',
              technical: 'roll = randomWord % totalWeight，随后按公布顺序做累积行走。详见第 07 章。',
            },
            {
              n: '07',
              title: '记录结果',
              body: '资产、数量、稀有度、奖品序号以及随机数本身，全部被存储并发出事件。',
              technical: 'SpinSettled 携带 spinId、player、rewardToken、rewardAmount、rarity、prizeIndex、randomWord 与 settledAt。',
            },
            {
              n: '08',
              title: '领取奖励',
              body: '奖励被转入为该次抽取付款的那个钱包。',
              technical: 'claimFor(uint256) 无权限限制，收款地址读自请求时写入的抽取状态。状态翻转先于转账，因此不可能重复领取。',
            },
          ],
        },
      ],
    },

    {
      id: 'machine-tiers',
      index: '05',
      title: '机器档位',
      lede: '三台机器，同一份资产名单。',
      blocks: [
        { t: 'live', kind: 'machines' },
        {
          t: 'callout',
          kind: 'important',
          text: '更高的档位价格更高，其奖品表也更偏向稀有一端。那是一条不同的分布曲线，而不是更划算的买卖，更不意味着能够盈利。',
        },
      ],
    },

    {
      id: 'reward-assets',
      index: '06',
      title: '奖励资产',
      lede: '机器里能掉出什么，以及它们是怎么进去的。',
      blocks: [
        {
          t: 'p',
          text: '奖励名单取自 BNB Chain 的原生项目。来自其他链的跨链映射资产被刻意排除在外——Bacha 存在的部分意义是带人认识这个生态，而一枚来自别处的封装资产做不到这一点。',
        },
        { t: 'live', kind: 'tokens' },
        {
          t: 'code',
          lang: 'ts',
          caption: '一项奖励资产在登记表中的条目。',
          code: `{
  id: string
  name: string
  symbol: string
  address: \`0x\${string}\`   // the identity
  decimals: number
  logo: string
  category: string
  enabled: boolean          // custodied by the vault
  rewardEnabled: boolean    // eligible for a prize table
  liquidityUsd?: number
  volume24hUsd?: number
  transferNotes?: string    // e.g. fee-on-transfer history
  source: { coingecko?, dexscreener?, bscscan? }
  verifiedAt: string
}`,
        },
        {
          t: 'callout',
          kind: 'security',
          title: '代号只是标签，合约地址才是身份。',
          text: '系统中的每一次查找都以地址为键。这里刻意没有提供「按代号解析代币」的函数，因为两个合约可以声称使用同一个代号，而其中只有一个是你真正想要的资产。',
        },
      ],
    },

    {
      id: 'prize-tables',
      index: '07',
      title: '奖品表与公开概率',
      lede: '权重如何变成概率。',
      blocks: [
        {
          t: 'p',
          text: '一张奖品表是一组条目。每个条目以地址指明一项资产，并给出以最小单位计的固定数量、一个权重，以及一个稀有度等级。概率就是某个权重在总权重中所占的份额。',
        },
        {
          t: 'callout',
          kind: 'formula',
          title: '条目 i 的概率',
          text: 'P(i) = weight(i) / Σ weight(j)，其中 j 遍历表中所有条目',
        },
        {
          t: 'p',
          text: '选择过程是一次累积行走。随机数对总权重取模，累积区间包含该值的条目胜出。给定一个随机数和一张表，答案有且只有一个，并且不依赖任何运营方可以左右的因素——不依赖时间，不依赖区块高度，也不依赖余额。',
        },
        {
          t: 'code',
          lang: 'text',
          caption: '与 BachaGame._selectPrize 一致。',
          code: `roll = randomWord % totalWeight
cumulative = 0

for entry in prizes:            # in published order
    cumulative += entry.weight
    if roll < cumulative:
        return entry            # exactly one prize, always`,
        },
        {
          t: 'callout',
          kind: 'note',
          title: '示意用例',
          text: '一张总权重为 10,000 的表，可能划分为 0–6799 普通、6800–9099 罕见、9100–9899 稀有、9900–9999 史诗。这些区间只用于说明行走的形状，并非生产环境的概率。实时概率公布在公平性页面。',
        },
        { t: 'live', kind: 'odds-link' },
        {
          t: 'p',
          text: '奖品数量以整数代币撰写，但以精确的最小单位存储，因此浮点数永远不会进入一张已公布的表。这件事比听上去更重要：在 18 位精度下，粗糙的十进制转换会把 1.2 变成 1.199999999999999956，而以这种方式公布的表，会在每一次抽取中都少付给玩家一点点。',
        },
      ],
    },

    {
      id: 'randomness',
      index: '08',
      title: '随机数',
      lede: '机器不做选择。',
      blocks: [
        { t: 'art', id: 'proof-core', alt: '内含随机数立方体的透明验证核心。', width: 'wide' },
        {
          t: 'p',
          text: '一次抽取的结果，不能被从中获利的一方知晓或选择。仅这一条要求，就排除了大多数省事的做法。',
        },
        {
          t: 'table',
          head: ['来源', '为何不适用'],
          rows: [
            ['Math.random() 或浏览器 RNG', '运行在玩家的机器上，可以被轻易替换。结果会变成「客户端说是什么就是什么」。'],
            ['block.timestamp', '在一定容差内由出块验证者选定。对结果有利益关系的验证者可以推动它。'],
            ['仅使用 blockhash', '提议者在公布之前就已知晓，且只能取到近期区块。对恰恰最不该预知的一方是可预测的。'],
            ['服务端私有密钥', '运营方先于玩家看到结果，可以选择不公布不利的那一个。从构造上就无法验证。'],
          ],
        },
        {
          t: 'callout',
          kind: 'security',
          title: '把要求说清楚',
          text: '从中获利的一方不能选择结果，并且任何人事后都能核对「记录的结果确实由记录的输入推导而来」。',
        },
        { t: 'h3', text: 'Bacha 的做法' },
        {
          t: 'p',
          text: 'Bacha 运行自己的承诺—揭示信标，而不是付费给外部预言机。每一个随机数都由两项没有任何单方能控制的输入构成，而实现它的合约就在本仓库中，与其余代码使用同一份许可证。',
        },
        {
          t: 'steps',
          items: [
            {
              n: '01',
              title: '种子提前承诺',
              body: '在任何人抽取之前很久，运营方就公布一个 32 字节随机种子的哈希。链上只有哈希，种子本身保密。',
              technical: 'commit(bytes32[]) 向队列追加。种子取自平台 CSPRNG，且绝不重用——重复的种子会让后一次的随机数可以从前一次的揭示中推算出来。',
            },
            {
              n: '02',
              title: '抽取按顺序取用下一个',
              body: '付款会按顺序消耗下一个未使用的承诺。没有人能挑选某次抽取用哪个种子。',
              technical: 'requestRandomWords 推进 FIFO 游标，并为该请求打上一个位于未来若干区块之后的 revealBlock。队列为空时抽取直接回滚，而不是卖出一次无法结算的抽取。',
            },
            {
              n: '03',
              title: '一个未来的区块封定结果',
              body: '随机数把种子与「付款之后才被挖出的某个区块」的哈希混合——那是运营方与玩家当时都不知道的数字。',
              technical: 'word = keccak256(seed, blockhash(revealBlock), requestId, consumer)。blockhash 只能回溯 256 个区块；超出之后揭示会被拒绝，该次抽取转入退款路径。',
            },
            {
              n: '04',
              title: '任何人都能重算',
              body: '一旦揭示，种子与区块哈希都是公开的，因此这套算术任何人都能重做一遍。',
              technical: 'deriveWord(seed, blockHash, requestId, consumer) 是 pure 视图函数。公平性页面上的验证器调用的正是它。',
            },
          ],
        },
        {
          t: 'callout',
          kind: 'formula',
          title: '随机数',
          text: 'word = keccak256( seed ‖ blockhash(revealBlock) ‖ requestId ‖ consumer )',
        },
        {
          t: 'callout',
          kind: 'risk',
          title: '它没有提供什么',
          text: '这不是可验证随机函数。没有任何密码学证明能证明运营方规矩行事——有的只是一个它无法更改的种子，和一个它无法预测的区块哈希。它也会在揭示区块被挖出的那一刻就知道结果，并且可以对不喜欢的结果拒绝揭示。它无法把那次抽取变成另一个结果，随机数早已固定。拒绝揭示属于骚扰而非窃取，退款超时为其设定了上限——超过窗口后任何人都可以为该次抽取发起退款。未被打开的承诺会永远留在链上可见。',
        },
        { t: 'live', kind: 'deployment' },
      ],
    },

    {
      id: 'settlement',
      index: '09',
      title: '结算与发放',
      lede: '为什么「选出奖励」和「转移奖励」是两个独立步骤。',
      blocks: [
        {
          t: 'p',
          text: '随机数回调只记录结果，不转移任何东西。这种分离是刻意的，也是整个合约中最重要的结构性决定。',
        },
        {
          t: 'p',
          text: '如果回调直接转账，那么任何在转账时回滚的资产——被暂停的代币、被列入黑名单的收款地址、行为异常的 BEP-20——都会导致回调本身失败。随机数已被消耗，抽取却仍停留在待定状态，玩家就被卡住了。让回调只写存储，意味着它不可能因为某项奖励资产的行为而失败。',
        },
        {
          t: 'flow',
          steps: [
            { label: '回调', detail: '记录结果' },
            { label: 'claimFor', detail: '任何人都可调用' },
            { label: '金库', detail: '转给记录在案的钱包' },
          ],
        },
        {
          t: 'callout',
          kind: 'onchain',
          title: '机器人可以代劳，但无法改道',
          text: 'claimFor(spinId) 没有权限限制，因此结算工作进程可以代玩家发放奖励。收款地址早在随机数存在之前就已写入抽取状态，调用者做什么都无法改变收款人。玩家也始终可以自行领取。',
        },
      ],
    },

    {
      id: 'vault',
      index: '10',
      title: '金库与储备安全',
      lede: '这台机器实际付得起什么。',
      blocks: [
        { t: 'art', id: 'reward-vault', alt: '装着扭蛋的敞开金库。', width: 'narrow' },
        {
          t: 'facts',
          items: [
            { label: '可用', value: '金库此刻实际持有的数量' },
            { label: '已预留', value: '欠付给「已结算未领取」与「进行中」抽取的数量' },
            { label: '可提取', value: '可用减去已预留——仅此而已' },
          ],
        },
        {
          t: 'p',
          text: '「已预留」按最坏情况计，而非按平均值。对每一次仍在等待随机数的抽取，合约都假设它将命中该资产上最大的那个条目。如果有十次抽取正在一张 CAKE 最大奖为 12 CAKE 的表上进行，金库就会把 120 CAKE 视为已被占用，尽管期望值远低于此。',
        },
        {
          t: 'callout',
          kind: 'important',
          title: '机器不该承诺一份它付不起的奖励。',
          text: '在接受一次抽取之前，合约会检查金库是否持有足够的每一项表内资产，以在已有全部欠付之上，再覆盖这次抽取的最坏情况。若不足，该次抽取被拒绝。已经作出的义务绝不会被挪用来腾出空间。',
        },
        {
          t: 'p',
          text: '同一套记账也约束提取。司库只能取走扣除全部义务之后剩下的部分，因此玩家已记录在案的奖励不会被从其名下提走。',
        },
      ],
    },

    {
      id: 'machine-versioning',
      index: '11',
      title: '机器版本管理',
      lede: '抽取之后，概率不会改变。',
      blocks: [
        {
          t: 'p',
          text: '公布一张奖品表会分配一个新的版本号。合约中不存在任何可以编辑已公布版本的函数——不是「仅管理员可用」，也不是「有时间锁保护」。它根本不存在。',
        },
        {
          t: 'flow',
          steps: [
            { label: 'QUICK v1', detail: '第 1821 次抽取打标于此' },
            { label: 'QUICK v2', detail: '仅对新抽取生效' },
            { label: '第 1821 次抽取', detail: '仍按 v1 结算' },
          ],
        },
        {
          t: 'p',
          text: '修改概率意味着公布一个新版本，并把档位指向它。已在进行中的抽取会保留它被打上的版本与表哈希，因此它按售出时的那张表结算。这一点由一个合约测试覆盖，也由一个跨任意抽取、公布与重指向序列都成立的不变量覆盖。',
        },
        {
          t: 'callout',
          kind: 'onchain',
          text: '一次抽取会在付款时记录 machineVersion 与 prizeTableHash。两者都会由验证器展示，玩家可据此确认结果来自哪张表。',
        },
      ],
    },

    {
      id: 'token-configuration',
      index: '12',
      title: '代币配置',
      lede: '一项资产如何取得入选资格。',
      blocks: [
        {
          t: 'steps',
          items: [
            { n: '01', title: '合约地址', body: '资产以地址标识，取自可靠的收录来源，而不是通过搜索代号得来。' },
            { n: '02', title: '独立确认', body: '该地址会与第二个直接索引链上数据的来源交叉比对。' },
            { n: '03', title: '链上确认', body: '直接调用合约以确认 decimals、symbol 与总供应量。这是权威答案，优先于任何第三方收录。' },
            { n: '04', title: '转账行为', body: '任何异常都会被记录——转账收费历史、非标准精度等——并且金库以实测余额差额入账，而非以请求数量入账。' },
            { n: '05', title: '流动性', body: 'DEX 上流动性偏薄会被标注，并使奖品数量保持较小，因为一份无法按显示价格卖出的奖励，并不值它看上去的那个价。' },
            { n: '06', title: '批准与启用', body: '资产必须先被金库批准才能托管，并且必须被标记为「可作奖励」，才能出现在某张表中。' },
          ],
        },
        {
          t: 'callout',
          kind: 'security',
          text: '仓库中的一个脚本会对实时来源重跑第一至第三步，一旦出现分歧即以非零状态退出，因此登记表的偏移是被主动发现的，而不是由某位收到错误资产的玩家发现的。',
        },
      ],
    },

    {
      id: 'contracts',
      index: '13',
      title: '合约',
      lede: '已实现了什么，以及已部署了什么。',
      blocks: [
        { t: 'live', kind: 'contracts' },
        { t: 'h3', text: 'BachaGame' },
        {
          t: 'ul',
          items: [
            '接受抽取、核验付款金额是否完全一致，并打上机器版本。',
            '公布不可变的奖品表并配置档位。',
            '请求随机数并记录结算结果。',
            '提供 claimFor、claimMany 与 refundExpiredSpin。',
            '计算 pendingLiabilityOf 与 remainingFundedSpins，用以约束金库可以释放的数量。',
          ],
        },
        { t: 'h3', text: 'BachaVault' },
        {
          t: 'ul',
          items: [
            '托管已批准的奖励资产，并接受任何人注资。',
            '仅在游戏合约指令下转出一份已结算的奖品，除此之外不转出。',
            '在允许司库提取之前，先扣除全部义务。',
            '可以救回未批准的资产，并拒绝对已批准的资产执行救援。',
          ],
        },
        {
          t: 'table',
          head: ['角色', '持有者', '可以'],
          rows: [
            ['DEFAULT_ADMIN_ROLE', '生产环境中为多签', '授予与撤销角色、批准资产、设置金库所绑定的游戏合约'],
            ['OPERATOR_ROLE', '生产环境中为多签', '公布奖品表、配置档位、暂停、设置随机数配置'],
            ['TREASURER_ROLE', '生产环境中为多签', '提取未预留的库存与抽取收入'],
            ['GAME_ROLE', '游戏合约', '指令金库向一位已记录在案的中奖者付款'],
          ],
        },
      ],
    },

    {
      id: 'security',
      index: '14',
      title: '安全模型',
      lede: '保护了什么，靠什么保护。',
      blocks: [
        {
          t: 'table',
          head: ['防护对象', '机制'],
          rows: [
            ['重入', '所有涉及价值转移的路径均带 ReentrancyGuard，且先写状态后做外部交互'],
            ['异常的 BEP-20 行为', '全程使用 SafeERC20；注资按实测余额差额入账'],
            ['紧急停止', 'Pausable 仅作用于 spin()——待定的抽取仍会结算并保持可领取'],
            ['权限', 'AccessControl，管理员、操作员、司库与游戏合约角色彼此分离'],
            ['篡改概率', '已公布的版本仅可追加；不存在修改函数'],
            ['重复结算', '对已结算抽取的重复回调会被忽略，而非回滚'],
            ['重复领取', '状态在转账之前翻转为 Claimed，因此第二次领取会回滚'],
            ['资不抵债', '在接受抽取之前核验最坏情况下的库存'],
            ['提走已欠付资金', '可提取额已扣除「已结算未领取」与「进行中」的负债'],
            ['任意奖励资产', '金库白名单；公布时表会拒绝未批准的资产'],
            ['随机数卡住', '超时后任何人都可发起退款'],
          ],
        },
        {
          t: 'callout',
          kind: 'security',
          title: '尚未审计',
          text: '这些合约尚未经过第三方审计。测试套件覆盖 51 个用例，其中包含六个跨任意操作序列的不变量，但测试是由写代码的同一批人写的，不能替代外部审查。',
        },
        { t: 'h3', text: '运营方可以改变什么' },
        {
          t: 'ul',
          items: [
            '暂停与恢复新的抽取。',
            '在金库上批准或取消批准奖励资产。',
            '公布新的奖品表版本，并把档位重新指向它们。',
            '调整档位价格与随机数配置。',
            '提取收入，以及未被预留的库存。',
          ],
        },
        { t: 'h3', text: '他们不能改变什么' },
        {
          t: 'ul',
          items: [
            '已有抽取上记录的版本或表哈希。',
            '已经结算的结果。',
            '一份已记录奖励的收款钱包。',
            '已被某项义务预留的库存。',
          ],
        },
      ],
    },

    {
      id: 'failure-states',
      index: '15',
      title: '失败状态',
      lede: '出问题时会发生什么。',
      blocks: [
        {
          t: 'table',
          head: ['情形', '玩家看到什么', '链上发生什么'],
          rows: [
            ['在钱包中拒绝交易', '一条明确告知「未花费任何资金」的提示', '什么也没有。没有创建任何抽取。'],
            ['随机数延迟', '抽取保持待定，其奖品表已锁定', '抽取保持 Pending；超时后任何人都可触发价格退款'],
            ['奖励库存不足', '该机器拒绝新的抽取', 'spin() 以 InsufficientInventory 回滚；已有义务不受影响'],
            ['奖励转账失败', '领取未完成，奖励仍可领取', '状态仅在转账成功后翻转，因此领取可以重试'],
            ['机器已暂停', '一条说明机器不可用的提示', 'spin() 回滚；待定的抽取仍会结算并保持可领取'],
            ['RPC 或索引器不可用', '信息流显示为空，而不是陈旧或编造的数据', '什么也没有。链本身不受前端故障影响。'],
          ],
        },
      ],
    },

    {
      id: 'economics',
      index: '16',
      title: '经济模型',
      lede: '钱去了哪里。',
      blocks: [
        {
          t: 'p',
          text: '抽取价格以 BNB 支付并累积在游戏合约中。司库可以提取，但需扣除待定抽取仍可能通过退款取回的部分。奖励库存则单独注资到金库；注资无需权限，且不因此获得对这些资产的任何索取权。',
        },
        {
          t: 'p',
          text: '奖品表在撰写时会使期望支付低于抽取价格。这部分差额正是库存与运营成本的资金来源。这里明说出来，是因为一款期望支付高于售价的游戏，活不到能付给任何人钱的那一天。',
        },
        {
          t: 'callout',
          kind: 'formula',
          title: '期望值',
          text: 'EV = Σ ( P(i) × 奖励 i 的市场价值 )。右侧每一项都在持续变动，因此这是某一时刻的估算，而不是预测。',
        },
        {
          t: 'callout',
          kind: 'risk',
          text: '市场价格会变，因此任何已公布表的美元价值也随之变化。没有任何一次抽取被保证能返还高于其成本的价值，界面也从不把估算呈现为回报。',
        },
        {
          t: 'p',
          text: 'Bacha 没有原生代币。本文档任何地方都未规划、描述或暗示任何代币，系统的任何部分也不依赖于某个代币的存在。',
        },
      ],
    },

    {
      id: 'risks',
      index: '17',
      title: '风险与局限',
      lede: '把可能出错的地方直说。',
      blocks: [
        {
          t: 'ul',
          items: [
            '代币价格波动。一份奖励的价值可能大幅下跌，包括跌至零。',
            '智能合约风险。合约未经审计，可能存在缺陷。',
            '管理密钥风险。特权角色可以暂停系统并提取未预留资金。密钥保管是最大的单一运营风险。',
            '随机数提供方风险。响应延迟或失败会使抽取保持待定，直到退款窗口开启。',
            '奖励代币行为风险。一项资产可能被其发行方暂停、升级或设为不可转让，这与 Bacha 无关。',
            '流动性风险。若某项资产的链上流动性偏薄，显示的价格可能无法实际成交。',
            '显示风险。价格来自第三方数据源，可能有误、陈旧或不可用。它们从不影响结算。',
            '基础设施风险。RPC 或索引器故障会使界面数据不完整，而链本身不受影响。',
            '监管风险。付费的随机奖品且奖品具有可转让价值，在各司法管辖区的处理方式不同。',
          ],
        },
        {
          t: 'callout',
          kind: 'risk',
          text: '只投入你完全承受得起全部损失的金额。大多数抽取的回报低于其成本。',
        },
      ],
    },

    {
      id: 'deployment-state',
      index: '18',
      title: '部署状态',
      lede: '此刻实际在运行的是什么。',
      blocks: [
        { t: 'live', kind: 'deployment' },
        {
          t: 'p',
          text: '这张表读自正在运行的应用，而不是写死在此处，因此它不会与它所描述的部署脱节。',
        },
      ],
    },

    {
      id: 'future-work',
      index: '19',
      title: '后续工作',
      lede: '可信的下一步，不设日期。',
      blocks: [
        {
          t: 'ul',
          items: [
            '部署到 BNB Smart Chain，开源验证合约，并由多签持有各项角色。',
            '信标在主网上以已承诺的种子运行，取代模拟结算。',
            '建立索引化的抽取历史以加快信息流，同时保持链为事实来源。',
            '随着更多 BNB Chain 资产通过核验流程，扩充奖励名单。',
            '增加奖品表形状不同的新机器。',
            '在托管任何实质价值之前完成外部安全审查。',
          ],
        },
        {
          t: 'callout',
          kind: 'note',
          text: '以上均未承诺任何日期，也不应被读作承诺。列出它们，只是因为现有架构已经能够容纳它们。',
        },
      ],
    },

    {
      id: 'glossary',
      index: '20',
      title: '术语表',
      blocks: [
        {
          t: 'facts',
          items: [
            { label: 'BNB Smart Chain', value: 'Bacha 运行其上的 EVM 链。主网链 ID 为 56，测试网为 97。' },
            { label: 'BEP-20', value: '奖励所使用的代币标准，形态上等同于 ERC-20。' },
            { label: '机器', value: '一个拥有自身价格与奖品表的档位。共有 Quick、Boost 与 Max。' },
            { label: '机器版本', value: '一张奖品表的不可变快照。每次抽取都会被打上其中之一。' },
            { label: '奖品表', value: '一次抽取可能落到的条目列表，每条带有数量、权重与稀有度。' },
            { label: '权重', value: '某个条目在总权重中所占的份额。概率即权重除以总权重。' },
            { label: '抽取', value: '一次付费抽取，自付款那一刻起以一个数字 id 标识。' },
            { label: '随机数', value: '由随机数提供方返回、并记录在该次抽取上的数字。' },
            { label: '结算', value: '随机数在表上完成行走并记录结果的那一刻。' },
            { label: '金库', value: '托管奖励库存的合约。' },
            { label: '储备', value: '欠付给「已结算未领取」与「进行中」抽取的库存，不可提取。' },
            { label: '领取', value: '把一份已记录的奖励转给为该次抽取付款的钱包。' },
            { label: '承诺 (Commitment)', value: '一个保密种子的哈希，在会用到它的那些抽取之前就已公布。' },
            { label: '揭示 (Reveal)', value: '打开一个已承诺的种子，使它产生的随机数可以被计算和核对。' },
          ],
        },
      ],
    },

    {
      id: 'references',
      index: '21',
      title: '参考资料',
      blocks: [
        {
          t: 'ul',
          items: [
            'BNB Chain 文档 — docs.bnbchain.org',
            'BachaRandomness — contracts/src/BachaRandomness.sol',
            'OpenZeppelin Contracts — docs.openzeppelin.com/contracts',
            'BscScan — bscscan.com',
            'Bacha 源码 — github.com/bachabnb/bacha',
          ],
        },
        {
          t: 'callout',
          kind: 'note',
          text: '已部署的合约地址（当它们存在时）会列在公平性页面，并直接链接到 BscScan。',
        },
      ],
    },
  ],
}
