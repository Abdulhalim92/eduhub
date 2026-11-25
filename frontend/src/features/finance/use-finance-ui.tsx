/* Панель и диалоги финансов центра для экрана: openFinance(id) — панель «Финансы центра», openTopUp(center) — пополнение.
   Пополнение и лимит открываются и из меню строки, и поверх панели; после сохранения панель и реестр перечитываются (api/mutations). */
import { useState } from 'react'
import type { CenterDto } from '@/api'
import { FinanceSheet } from './FinanceSheet'
import { OverdraftDialog } from './OverdraftDialog'
import { TopUpDialog } from './TopUpDialog'

export function useFinanceUi() {
  const [financeId, setFinanceId] = useState<number | null>(null)
  const [topUp, setTopUp] = useState<CenterDto | null>(null)
  const [limit, setLimit] = useState<CenterDto | null>(null)

  const ui = (
    <>
      <FinanceSheet centerId={financeId} onClose={() => setFinanceId(null)} onTopUp={setTopUp} onChangeLimit={setLimit} />
      <TopUpDialog center={topUp} onClose={() => setTopUp(null)} />
      <OverdraftDialog center={limit} onClose={() => setLimit(null)} />
    </>
  )
  return { openFinance: setFinanceId, openTopUp: setTopUp, ui }
}
