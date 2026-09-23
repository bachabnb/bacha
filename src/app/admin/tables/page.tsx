import { PageHeader } from '@/components/admin/AdminPrimitives'
import { PrizeTableEditor } from '@/components/admin/PrizeTableEditor'
import { readVaultBalances } from '@/lib/admin/vault'

export const dynamic = 'force-dynamic'

export default async function AdminTables() {
  const balances = await readVaultBalances()

  return (
    <>
      <PageHeader
        title="Prize tables"
        description="Build a table, see exactly what it would cost to honour, and publish it as a new immutable version. Nothing here edits an existing version — that is not possible, by design."
      />
      <PrizeTableEditor vaultBalances={balances} />
    </>
  )
}
