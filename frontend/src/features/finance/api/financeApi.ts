/* «Финансы центра» (PLT-BAL): баланс на платформе, журнал операций, открытые счета, пополнение, лимит овердрафта. */
import { baseApi, centerMoneyTags } from '@/api/baseApi'
import type { CenterDto } from '@/features/centers/api/types'
import type { CenterFinance, TopUpPayload } from './types'

export const financeApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getFinance: build.query<CenterFinance, number>({
      query: centerId => `/centers/${centerId}/finance`,
      providesTags: (_r, _e, centerId) => [{ type: 'Finance', id: centerId }],
    }),
    /** Деньги уже поступили вне системы; основания проверяет сервер (BR-002). */
    topUp: build.mutation<CenterDto, { centerId: number; payload: TopUpPayload }>({
      query: ({ centerId, payload }) => ({ url: `/centers/${centerId}/balance/top-up`, method: 'POST', body: payload }),
      invalidatesTags: (_r, _e, { centerId }) => [...centerMoneyTags(centerId)],
    }),
    setOverdraft: build.mutation<CenterDto, { centerId: number; limit: number | null; reason: string }>({
      query: ({ centerId, limit, reason }) => ({ url: `/centers/${centerId}/overdraft`, method: 'PUT', body: { limit, reason } }),
      invalidatesTags: (_r, _e, { centerId }) => [...centerMoneyTags(centerId)],
    }),
  }),
})

export const { useGetFinanceQuery, useTopUpMutation, useSetOverdraftMutation } = financeApi
