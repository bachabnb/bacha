import type { WhitepaperContent } from './types'

/**
 * Bacha whitepaper — English.
 *
 * Rules this document holds itself to:
 *   - Nothing is described as deployed that is not deployed.
 *   - No audit is claimed, because none has happened.
 *   - There is no Bacha token, so none is mentioned.
 *   - Every security property named here is one the contracts implement.
 */
export const en: WhitepaperContent = {
  version: '1.0',
  title: 'The machine, explained.',
  subtitle:
    "A technical overview of Bacha's machine architecture, reward system, randomness, reserves, published odds and settlement model on BNB Smart Chain.",

  chapters: [
    {
      id: 'abstract',
      index: '00',
      title: 'Abstract',
      blocks: [
        {
          t: 'p',
          text: 'Bacha is a capsule-machine reward game for BNB Smart Chain. A player selects a machine, pays a fixed price for one spin, and receives exactly one reward drawn from a published prize configuration.',
        },
        {
          t: 'p',
          text: 'The design is built around five properties: odds are published before a spin is bought; each spin records the machine configuration it was sold against; randomness comes from outside the operator; rewards are backed by inventory the contract checks before accepting payment; and every step of settlement is recorded where anyone can read it.',
        },
        {
          t: 'callout',
          kind: 'important',
          text: 'Bacha is a game and a token-discovery mechanism. It is not an investment product and it makes no promise of return. Most outcomes are worth less than the cost of a spin, by design.',
        },
      ],
    },

    {
      id: 'what-is-bacha',
      index: '01',
      title: 'What is Bacha?',
      lede: 'The mechanism of a physical capsule machine, moved onchain.',
      blocks: [
        {
          t: 'flow',
          steps: [
            { label: 'Player', detail: 'Pays a fixed price' },
            { label: 'Machine', detail: 'Locks its prize table' },
            { label: 'Randomness', detail: 'Returns one number' },
            { label: 'Reward', detail: 'One entry, recorded' },
          ],
        },
        {
          t: 'p',
          text: 'A capsule machine has worked the same way for fifty years. You pay, a drum turns, and something comes out. What you get is decided by mechanical chance operating over a fixed set of contents.',
        },
        {
          t: 'p',
          text: 'Bacha keeps that mechanism and replaces the drum with a contract. The contents become a prize table of BEP-20 assets with published weights. The mechanical chance becomes a random number the operator does not produce. The result becomes a permanent record rather than a plastic shell in your hand.',
        },
        { t: 'h3', text: 'What Bacha is' },
        {
          t: 'ul',
          items: [
            'A paid game with randomised outcomes, played one spin at a time.',
            'A way to receive small amounts of assets from projects native to BNB Chain.',
            'A system whose odds, randomness and settlement can be inspected by anyone.',
          ],
        },
        { t: 'h3', text: 'What Bacha is not' },
        {
          t: 'ul',
          items: [
            'An investment product, a yield mechanism or an income source.',
            'A promise that a spin is worth more than it cost.',
            'A protocol with its own token — Bacha has none, and none is planned in this document.',
          ],
        },
      ],
    },

    {
      id: 'design-principles',
      index: '02',
      title: 'Design principles',
      lede: 'Five commitments the architecture is arranged around.',
      blocks: [
        {
          t: 'steps',
          items: [
            {
              n: '01',
              title: 'Published',
              body: 'Odds are visible before a spin is bought, computed from the same weights the contract holds. The interface has no second copy of the odds that could drift.',
            },
            {
              n: '02',
              title: 'Versioned',
              body: 'Each spin records the machine configuration active when it was paid for. Changing odds later creates a new version; it does not rewrite an old spin.',
            },
            {
              n: '03',
              title: 'Verifiable',
              body: 'The random word, the table it resolved against and the resulting reward are all recorded. Anyone can repeat the arithmetic and reach the same answer.',
            },
            {
              n: '04',
              title: 'Reserved',
              body: 'The contract checks it can honour the worst case before accepting a spin, and refuses the spin if it cannot.',
            },
            {
              n: '05',
              title: 'Simple',
              body: 'The player experience stays three steps: connect, spin, reveal. Everything above sits behind that and never becomes the player’s problem.',
            },
          ],
        },
      ],
    },

    {
      id: 'architecture',
      index: '03',
      title: 'Machine architecture',
      lede: 'Four systems, one machine.',
      blocks: [
        { t: 'art', id: 'machine-exploded', alt: 'An exploded view of the Bacha machine.', width: 'narrow' },
        {
          t: 'table',
          head: ['Module', 'Responsibility', 'Input', 'Output'],
          rows: [
            ['Game contract', 'Spin requests, machine versions, randomness lifecycle, results', 'Payment, tier', 'Recorded spin and result'],
            ['Vault', 'Reward inventory, reserve accounting, payouts', 'Funding, payout instruction', 'Transferred reward'],
            ['Randomness', 'One unpredictable number per spin, from committed seeds', 'Request', 'Random word'],
            ['Token registry', 'Which assets are eligible, and their exact identity', 'Verified configuration', 'Address, decimals, metadata'],
          ],
        },
        {
          t: 'callout',
          kind: 'onchain',
          title: 'Separation of concerns',
          text: 'The vault holds no opinion about who should be paid. It exposes a payout the game can call, and refuses to release anything a spin has a claim on. The game is the single source of truth for what is owed, so there is no second copy of that accounting to drift.',
        },
      ],
    },

    {
      id: 'spin-lifecycle',
      index: '04',
      title: 'The spin lifecycle',
      lede: 'Eight steps from payment to payout.',
      blocks: [
        {
          t: 'steps',
          items: [
            {
              n: '01',
              title: 'Player selects a machine',
              body: 'Each machine is a tier with its own price and its own prize table.',
              technical: 'Tiers are stored as { exists, active, price, versionId, label } and read with getTier(uint8).',
            },
            {
              n: '02',
              title: 'Payment submitted',
              body: 'The spin price is paid in BNB. The amount must match exactly.',
              technical: 'spin(uint8 tierId) is payable and reverts with IncorrectPayment if msg.value does not equal the tier price. It is nonReentrant and whenNotPaused.',
            },
            {
              n: '03',
              title: 'Machine version locked',
              body: 'The spin is stamped with the machine version and the hash of that version’s prize table.',
              technical: 'versionId and prizeTableHash are written into the Spin struct before randomness is requested, alongside player, tier, payment and requestedAt.',
            },
            {
              n: '04',
              title: 'Randomness requested',
              body: 'The spin takes the next committed seed and is told which future block will close it.',
              technical: 'The beacon consumes its FIFO commitment queue and returns a requestId, mapped to the spin id. The request also records a revealBlock a few blocks ahead.',
            },
            {
              n: '05',
              title: 'Randomness returned',
              body: 'Once that block is mined the seed is opened and the word is delivered. Until then the spin stays pending.',
              technical: 'The callback writes storage and nothing else — no transfers, no external calls, no unbounded loops. A repeat delivery for the same request is ignored rather than reverted, so a retry cannot brick the queue.',
            },
            {
              n: '06',
              title: 'Prize index selected',
              body: 'The number is walked across the frozen weighted table and lands on exactly one entry.',
              technical: 'roll = randomWord % totalWeight, then a cumulative walk in published order. See chapter 07.',
            },
            {
              n: '07',
              title: 'Result recorded',
              body: 'The asset, amount, rarity, prize index and the random word itself are all stored and emitted.',
              technical: 'SpinSettled carries spinId, player, rewardToken, rewardAmount, rarity, prizeIndex, randomWord and settledAt.',
            },
            {
              n: '08',
              title: 'Reward claimed',
              body: 'The reward is transferred to the wallet that paid for the spin.',
              technical: 'claimFor(uint256) is permissionless and reads the recipient from spin state written at request time. The status flip precedes the transfer, so a second claim is impossible.',
            },
          ],
        },
      ],
    },

    {
      id: 'machine-tiers',
      index: '05',
      title: 'Machine tiers',
      lede: 'Three machines, one roster.',
      blocks: [
        { t: 'live', kind: 'machines' },
        {
          t: 'callout',
          kind: 'important',
          text: 'A higher tier costs more and weights its table further toward the rare end. It is a different distribution, not a better deal, and it carries no implication of profitability.',
        },
      ],
    },

    {
      id: 'reward-assets',
      index: '06',
      title: 'Reward assets',
      lede: 'What can come out of the machine, and how it gets in.',
      blocks: [
        {
          t: 'p',
          text: 'The reward roster is drawn from projects native to BNB Chain. Bridged representations of assets from other chains are excluded deliberately — Bacha exists partly to introduce people to this ecosystem, and a wrapped asset from elsewhere does not do that.',
        },
        { t: 'live', kind: 'tokens' },
        {
          t: 'code',
          lang: 'ts',
          caption: 'The registry entry for a reward asset.',
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
          title: 'Tickers are labels. Contract addresses are identity.',
          text: 'Every lookup in the system is keyed on address. There is deliberately no function to resolve a token by its ticker, because two contracts can claim the same symbol and only one of them is the asset you meant.',
        },
      ],
    },

    {
      id: 'prize-tables',
      index: '07',
      title: 'Prize tables and published odds',
      lede: 'How a weight becomes a probability.',
      blocks: [
        {
          t: 'p',
          text: 'A prize table is a list of entries. Each entry names an asset by address, a fixed amount in base units, a weight, and a rarity band. Probability is a weight’s share of the total.',
        },
        {
          t: 'callout',
          kind: 'formula',
          title: 'Probability of entry i',
          text: 'P(i) = weight(i) / Σ weight(j) for all j in the table',
        },
        {
          t: 'p',
          text: 'Selection is a cumulative walk. The random word is reduced modulo the total weight, and the entry whose cumulative range contains that value wins. Given a word and a table there is exactly one answer, and it depends on nothing an operator controls — not time, not block number, not balances.',
        },
        {
          t: 'code',
          lang: 'text',
          caption: 'Mirrors BachaGame._selectPrize.',
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
          title: 'Illustrative example',
          text: 'A table totalling 10,000 weight might band as 0–6799 common, 6800–9099 uncommon, 9100–9899 rare, 9900–9999 epic. These are illustrative bands to show the shape of the walk, not production odds. Live odds are published on the fairness page.',
        },
        { t: 'live', kind: 'odds-link' },
        {
          t: 'p',
          text: 'Amounts are authored in whole tokens but stored as exact base units, so a floating-point value never reaches a published table. This matters more than it sounds: naive decimal conversion turns 1.2 into 1.199999999999999956 at eighteen decimals, and a table published that way would short every player by a fraction on every spin.',
        },
      ],
    },

    {
      id: 'randomness',
      index: '08',
      title: 'Randomness',
      lede: 'The machine does not choose.',
      blocks: [
        { t: 'art', id: 'proof-core', alt: 'A transparent verification core with a randomness cube inside.', width: 'wide' },
        {
          t: 'p',
          text: 'The outcome of a spin must not be knowable or choosable by the party that profits from it. That single requirement rules out most of the easy options.',
        },
        {
          t: 'table',
          head: ['Source', 'Why it is unsuitable'],
          rows: [
            ['Math.random() or browser RNG', 'Runs on the player’s machine and is trivially replaceable. The result would be whatever the client says it is.'],
            ['block.timestamp', 'Chosen by the validator producing the block, within a tolerance. A validator with a stake in the outcome can nudge it.'],
            ['blockhash alone', 'Known to the proposer before it is published, and only available for recent blocks. Predictable to exactly the wrong party.'],
            ['A private server secret', 'The operator sees the result before the player does and can decline to publish an unfavourable one. Unverifiable by construction.'],
          ],
        },
        {
          t: 'callout',
          kind: 'security',
          title: 'The requirement, stated plainly',
          text: 'The party that profits must not be able to choose the outcome, and anyone must be able to check afterwards that the recorded result follows from the recorded inputs.',
        },
        { t: 'h3', text: 'How Bacha does it' },
        {
          t: 'p',
          text: 'Bacha runs its own commit–reveal beacon rather than paying an external oracle. Every word is built from two inputs that no single party controls, and the contract that does it is in this repository under the same licence as the rest.',
        },
        {
          t: 'steps',
          items: [
            {
              n: '01',
              title: 'Seeds are committed in advance',
              body: 'The operator publishes the hash of a random 32-byte seed long before anyone spins. Only the hash goes onchain; the seed stays secret.',
              technical: 'commit(bytes32[]) appends to a queue. Seeds come from the platform CSPRNG and are never reused — a repeated seed would make a later word predictable from an earlier reveal.',
            },
            {
              n: '02',
              title: 'A spin takes the next one in line',
              body: 'Paying for a spin consumes the next unused commitment, in order. Nobody picks which seed a spin gets.',
              technical: 'requestRandomWords consumes the FIFO cursor and stamps the request with a revealBlock a few blocks in the future. If the queue is empty the spin reverts rather than selling a spin that cannot settle.',
            },
            {
              n: '03',
              title: 'A future block closes the result',
              body: 'The word mixes the seed with the hash of a block mined after the spin was paid for — a number neither the operator nor the player knew at the time.',
              technical: 'word = keccak256(seed, blockhash(revealBlock), requestId, consumer). blockhash only reaches back 256 blocks; past that the reveal is refused and the spin falls through to the refund path.',
            },
            {
              n: '04',
              title: 'Anyone can recompute it',
              body: 'The seed and the block hash are both public once revealed, so the arithmetic can be repeated by anyone.',
              technical: 'deriveWord(seed, blockHash, requestId, consumer) is a pure view function. The verifier on the fairness page calls exactly it.',
            },
          ],
        },
        {
          t: 'callout',
          kind: 'formula',
          title: 'The word',
          text: 'word = keccak256( seed ‖ blockhash(revealBlock) ‖ requestId ‖ consumer )',
        },
        {
          t: 'callout',
          kind: 'risk',
          title: 'What this does not give you',
          text: 'This is not a verifiable random function. There is no cryptographic proof that the operator behaved — what there is, is a seed it cannot change and a block hash it cannot predict. It also learns the result the moment the reveal block is mined and could withhold a reveal it dislikes. It cannot turn that spin into a different result; the word is already fixed. Withholding is griefing, not theft, and the refund timeout bounds it — after the window anyone can refund the spin. An unopened commitment stays visible onchain forever.',
        },
        { t: 'live', kind: 'deployment' },
      ],
    },

    {
      id: 'settlement',
      index: '09',
      title: 'Settlement and payouts',
      lede: 'Why selecting a reward and moving it are two separate steps.',
      blocks: [
        {
          t: 'p',
          text: 'The randomness callback records the result. It does not transfer anything. That separation is deliberate and it is the most important structural decision in the contract.',
        },
        {
          t: 'p',
          text: 'If the callback transferred the reward, then any asset that reverts on transfer — a paused token, a blacklisted recipient, an unusual BEP-20 — would cause the callback itself to fail. The randomness would be consumed, the spin would stay pending, and the player would be stuck. Keeping the callback to storage writes means it cannot be made to fail by the behaviour of a reward asset.',
        },
        {
          t: 'flow',
          steps: [
            { label: 'Callback', detail: 'Records the result' },
            { label: 'claimFor', detail: 'Anyone may call' },
            { label: 'Vault', detail: 'Transfers to the recorded wallet' },
          ],
        },
        {
          t: 'callout',
          kind: 'onchain',
          title: 'A bot can help, but cannot redirect',
          text: 'claimFor(spinId) is permissionless, so a settlement worker can deliver rewards on players’ behalf. The destination was written into spin state before the random word existed, so nothing the caller does can change who gets paid. A player can always claim for themselves.',
        },
      ],
    },

    {
      id: 'vault',
      index: '10',
      title: 'Vault and reserve safety',
      lede: 'What the machine can actually pay.',
      blocks: [
        { t: 'art', id: 'reward-vault', alt: 'An open vault holding capsules.', width: 'narrow' },
        {
          t: 'facts',
          items: [
            { label: 'Available', value: 'What the vault holds right now' },
            { label: 'Reserved', value: 'Owed to settled-unclaimed and in-flight spins' },
            { label: 'Withdrawable', value: 'Available minus reserved — and nothing more' },
          ],
        },
        {
          t: 'p',
          text: 'Reserved is a worst case, not an average. For every spin still waiting on randomness, the contract assumes it will land on that asset’s largest entry. If ten spins are in flight on a table whose biggest CAKE prize is 12 CAKE, the vault treats 120 CAKE as spoken for even though the expected draw is far lower.',
        },
        {
          t: 'callout',
          kind: 'important',
          title: 'The machine should not promise a reward it cannot pay.',
          text: 'Before accepting a spin, the contract checks the vault holds enough of every asset in that table to cover this spin’s worst case on top of everything already owed. If it does not, the spin is refused. Obligations already made are never touched to make room.',
        },
        {
          t: 'p',
          text: 'The same accounting bounds withdrawals. A treasurer can only take out what is left after every obligation is subtracted, so a player’s recorded reward cannot be withdrawn out from under them.',
        },
      ],
    },

    {
      id: 'machine-versioning',
      index: '11',
      title: 'Machine versioning',
      lede: 'Odds do not change after you spin.',
      blocks: [
        {
          t: 'p',
          text: 'Publishing a prize table allocates a new version id. There is no function anywhere in the contract that edits a published version — not restricted to an admin, not gated behind a timelock. It does not exist.',
        },
        {
          t: 'flow',
          steps: [
            { label: 'QUICK v1', detail: 'Spin #1821 stamped here' },
            { label: 'QUICK v2', detail: 'New spins only' },
            { label: 'Spin #1821', detail: 'Still resolves against v1' },
          ],
        },
        {
          t: 'p',
          text: 'Changing odds means publishing a new version and repointing a tier at it. A spin already in flight keeps the version and table hash it was stamped with, so it settles against exactly what it was sold. This is covered by a contract test and by an invariant that holds across arbitrary sequences of spins, publishes and repointings.',
        },
        {
          t: 'callout',
          kind: 'onchain',
          text: 'A spin records machineVersion and prizeTableHash at payment time. Both are shown by the verifier, so a player can confirm the table their result came from.',
        },
      ],
    },

    {
      id: 'token-configuration',
      index: '12',
      title: 'Token configuration',
      lede: 'How an asset becomes eligible.',
      blocks: [
        {
          t: 'steps',
          items: [
            { n: '01', title: 'Contract address', body: 'The asset is identified by address, sourced from a reputable listing rather than from a ticker search.' },
            { n: '02', title: 'Independent confirmation', body: 'The address is cross-checked against a second source that indexes the chain directly.' },
            { n: '03', title: 'Onchain confirmation', body: 'A direct call to the contract confirms decimals, symbol and total supply. This is the authoritative answer and overrides any listing.' },
            { n: '04', title: 'Transfer behaviour', body: 'Anything unusual is recorded — fee-on-transfer history, non-standard decimals — and the vault credits measured balance deltas rather than requested amounts.' },
            { n: '05', title: 'Liquidity', body: 'Thin on-DEX liquidity is noted and keeps prize amounts small, because a reward that cannot be sold at the shown price is not worth what it appears to be.' },
            { n: '06', title: 'Approval and enablement', body: 'The vault must approve the asset before it can be custodied, and it must be flagged reward-enabled before it can appear in a table.' },
          ],
        },
        {
          t: 'callout',
          kind: 'security',
          text: 'A repository script re-runs steps one through three against live sources and exits non-zero on any disagreement, so registry drift is caught deliberately rather than discovered by a player receiving the wrong asset.',
        },
      ],
    },

    {
      id: 'contracts',
      index: '13',
      title: 'Contracts',
      lede: 'What is implemented, and what is deployed.',
      blocks: [
        { t: 'live', kind: 'contracts' },
        { t: 'h3', text: 'BachaGame' },
        {
          t: 'ul',
          items: [
            'Accepts spins, verifies exact payment and stamps the machine version.',
            'Publishes immutable prize tables and configures tiers.',
            'Requests randomness and records the settled result.',
            'Exposes claimFor, claimMany and refundExpiredSpin.',
            'Computes pendingLiabilityOf and remainingFundedSpins, which bound what the vault will release.',
          ],
        },
        { t: 'h3', text: 'BachaVault' },
        {
          t: 'ul',
          items: [
            'Custodies approved reward assets and accepts permissionless funding.',
            'Transfers a settled prize when the game instructs it, and only then.',
            'Subtracts every obligation before allowing a treasurer withdrawal.',
            'Can rescue an unapproved asset, and refuses to do so for an approved one.',
          ],
        },
        {
          t: 'table',
          head: ['Role', 'Held by', 'Can'],
          rows: [
            ['DEFAULT_ADMIN_ROLE', 'Multisig in production', 'Grant and revoke roles, approve assets, set the vault’s game'],
            ['OPERATOR_ROLE', 'Multisig in production', 'Publish tables, configure tiers, pause, set randomness config'],
            ['TREASURER_ROLE', 'Multisig in production', 'Withdraw unreserved inventory and spin revenue'],
            ['GAME_ROLE', 'The game contract', 'Instruct the vault to pay a recorded winner'],
          ],
        },
      ],
    },

    {
      id: 'security',
      index: '14',
      title: 'Security model',
      lede: 'What is protected, and by what.',
      blocks: [
        {
          t: 'table',
          head: ['Protection', 'Mechanism'],
          rows: [
            ['Reentrancy', 'ReentrancyGuard on every value-moving path, with effects written before interactions'],
            ['Unusual BEP-20 behaviour', 'SafeERC20 throughout; funding credits measured balance deltas'],
            ['Emergency stop', 'Pausable on spin() only — pending spins still settle and stay claimable'],
            ['Privilege', 'AccessControl with separate admin, operator, treasurer and game roles'],
            ['Odds tampering', 'Published versions are append-only; no mutator exists'],
            ['Duplicate settlement', 'A repeat callback for a settled spin is ignored, not reverted'],
            ['Duplicate claim', 'Status flips to Claimed before the transfer, so a second claim reverts'],
            ['Insolvency', 'Worst-case inventory checked before a spin is accepted'],
            ['Withdrawal of owed funds', 'Withdrawable subtracts settled-unclaimed and in-flight liability'],
            ['Arbitrary reward assets', 'Vault allowlist; tables reject unapproved assets at publish time'],
            ['Stuck randomness', 'Permissionless refund after a bounded timeout'],
          ],
        },
        {
          t: 'callout',
          kind: 'security',
          title: 'Not yet audited',
          text: 'These contracts have not been audited by a third party. The test suite covers 51 cases including six invariants over arbitrary action sequences, but a test suite is written by the same people who wrote the code and is not a substitute for external review.',
        },
        { t: 'h3', text: 'What operators can change' },
        {
          t: 'ul',
          items: [
            'Pause and unpause new spins.',
            'Approve or disapprove reward assets on the vault.',
            'Publish new prize table versions and repoint tiers at them.',
            'Adjust tier prices and the randomness configuration.',
            'Withdraw revenue and inventory that is not reserved.',
          ],
        },
        { t: 'h3', text: 'What they cannot change' },
        {
          t: 'ul',
          items: [
            'The version or table hash recorded on an existing spin.',
            'A result that has already settled.',
            'The wallet a recorded reward is paid to.',
            'Inventory that is reserved against an obligation.',
          ],
        },
      ],
    },

    {
      id: 'failure-states',
      index: '15',
      title: 'Failure states',
      lede: 'What happens when something does not work.',
      blocks: [
        {
          t: 'table',
          head: ['Situation', 'What the player sees', 'What happens onchain'],
          rows: [
            ['Transaction rejected in wallet', 'A plain message saying nothing was spent', 'Nothing. No spin was created.'],
            ['Randomness delayed', 'The spin stays pending with its table already locked', 'Spin remains Pending; after the timeout anyone can trigger a refund of the price'],
            ['Reward inventory low', 'That machine declines new spins', 'spin() reverts with InsufficientInventory; existing obligations untouched'],
            ['Reward transfer fails', 'The claim does not go through; the reward stays claimable', 'Status only flips on a successful transfer, so the claim can be retried'],
            ['Machine paused', 'A message saying the machine is unavailable', 'spin() reverts; pending spins still settle and stay claimable'],
            ['RPC or indexer unavailable', 'Feeds show empty rather than stale or invented rows', 'Nothing. The chain is unaffected by a frontend outage.'],
          ],
        },
      ],
    },

    {
      id: 'economics',
      index: '16',
      title: 'Economics',
      lede: 'Where the money goes.',
      blocks: [
        {
          t: 'p',
          text: 'A spin price is paid in BNB and accumulates in the game contract. It is withdrawable by a treasurer, less anything a pending spin could still reclaim through a refund. Reward inventory is funded separately into the vault; funding is permissionless and grants no claim on the assets.',
        },
        {
          t: 'p',
          text: 'Prize tables are authored so that expected payout sits below the spin price. That margin is what funds inventory and operating costs. It is stated here because a game whose expected payout exceeded its price would not survive long enough to pay anyone.',
        },
        {
          t: 'callout',
          kind: 'formula',
          title: 'Expected value',
          text: 'EV = Σ ( P(i) × market value of reward i ). Every term on the right moves continuously, so this is an estimate at a moment in time and not a projection.',
        },
        {
          t: 'callout',
          kind: 'risk',
          text: 'Market prices change, so the dollar value of any published table changes with them. No spin is guaranteed to return more than it cost, and the interface never presents an estimate as a return.',
        },
        {
          t: 'p',
          text: 'Bacha has no native token. No token is planned, described or implied anywhere in this document, and no part of the system depends on one existing.',
        },
      ],
    },

    {
      id: 'risks',
      index: '17',
      title: 'Risks and limitations',
      lede: 'What can go wrong, stated plainly.',
      blocks: [
        {
          t: 'ul',
          items: [
            'Token price volatility. A reward’s value can fall sharply, including to zero.',
            'Smart contract risk. The contracts are unaudited and may contain defects.',
            'Admin key risk. Privileged roles can pause the system and withdraw unreserved funds. Key custody is the single largest operational risk.',
            'Randomness provider risk. A delayed or failed response leaves a spin pending until the refund window opens.',
            'Reward token behaviour. An asset can be paused, upgraded or made non-transferable by its own issuer, independently of Bacha.',
            'Liquidity risk. A displayed price may not be achievable if on-chain liquidity for that asset is thin.',
            'Display risk. Prices come from a third-party feed and can be wrong, stale or unavailable. They never affect settlement.',
            'Infrastructure risk. RPC or indexer outages can make the interface incomplete while the chain itself is unaffected.',
            'Regulatory risk. Paid randomised prizes with transferable value are treated differently across jurisdictions.',
          ],
        },
        {
          t: 'callout',
          kind: 'risk',
          text: 'Only spend what you can afford to lose entirely. Most spins return less than they cost.',
        },
      ],
    },

    {
      id: 'deployment-state',
      index: '18',
      title: 'Deployment state',
      lede: 'What is running right now.',
      blocks: [
        { t: 'live', kind: 'deployment' },
        {
          t: 'p',
          text: 'This matrix is read from the running application rather than written here, so it cannot fall out of date relative to the deployment it describes.',
        },
      ],
    },

    {
      id: 'future-work',
      index: '19',
      title: 'Future work',
      lede: 'Credible next steps, without dates.',
      blocks: [
        {
          t: 'ul',
          items: [
            'Deployment to BNB Smart Chain with verified source and multisig-held roles.',
            'Beacon running against mainnet with committed seeds, replacing simulated settlement.',
            'Indexed spin history for faster feeds, with the chain remaining the source of truth.',
            'A broader reward roster as more BNB Chain assets clear the verification pipeline.',
            'Additional machines with different prize-table shapes.',
            'External security review before any material value is custodied.',
          ],
        },
        {
          t: 'callout',
          kind: 'note',
          text: 'None of the above is committed to a date, and nothing here should be read as a promise. Items are listed because the architecture already accommodates them.',
        },
      ],
    },

    {
      id: 'glossary',
      index: '20',
      title: 'Glossary',
      blocks: [
        {
          t: 'facts',
          items: [
            { label: 'BNB Smart Chain', value: 'The EVM chain Bacha runs on. Chain ID 56 for mainnet, 97 for testnet.' },
            { label: 'BEP-20', value: 'The token standard rewards use. Equivalent in shape to ERC-20.' },
            { label: 'Machine', value: 'A tier with its own price and prize table. Quick, Boost and Max.' },
            { label: 'Machine version', value: 'An immutable snapshot of a prize table. Spins are stamped with one.' },
            { label: 'Prize table', value: 'The list of entries a spin can resolve to, each with an amount, weight and rarity.' },
            { label: 'Weight', value: 'An entry’s share of the total. Probability is weight divided by total weight.' },
            { label: 'Spin', value: 'One paid pull, identified by a numeric id from the moment it is paid for.' },
            { label: 'Random word', value: 'The number returned by the randomness provider and recorded against the spin.' },
            { label: 'Settlement', value: 'The moment the random word is walked across the table and a result is recorded.' },
            { label: 'Vault', value: 'The contract custodying reward inventory.' },
            { label: 'Reserve', value: 'Inventory owed to settled-unclaimed and in-flight spins. Not withdrawable.' },
            { label: 'Claim', value: 'Transferring a recorded reward to the wallet that paid for the spin.' },
            { label: 'Commitment', value: 'The hash of a secret seed, published before the spins that will use it.' },
            { label: 'Reveal', value: 'Opening a committed seed so the word it produces can be computed and checked.' },
          ],
        },
      ],
    },

    {
      id: 'references',
      index: '21',
      title: 'References',
      blocks: [
        {
          t: 'ul',
          items: [
            'BNB Chain documentation — docs.bnbchain.org',
            'BachaRandomness — contracts/src/BachaRandomness.sol',
            'OpenZeppelin Contracts — docs.openzeppelin.com/contracts',
            'BscScan — bscscan.com',
            'Bacha source — github.com/bachabnb/bacha',
          ],
        },
        {
          t: 'callout',
          kind: 'note',
          text: 'Deployed contract addresses, when they exist, are listed on the fairness page and link directly to BscScan.',
        },
      ],
    },
  ],
}
