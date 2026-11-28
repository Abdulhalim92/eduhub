/* «Истекающие подписки» (PLT-DSH-030): окно 7/14/30 дней, напоминания владельцам, счёт на продление. */
import { baseApi, centerListTags, centerMoneyTags } from '@/api/baseApi'
import type { CenterDto } from '@/features/centers/api/types'
import type { ExpiringList } from './types'

export const expiringApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getExpiring: build.query<ExpiringList, number>({
      query: withinDays => ({ url: '/centers/expiring', params: { withinDays } }),
      providesTags: [{ type: 'Center', id: 'LIST' }],
    }),
    /** Напоминание о продлении; ответ — сколько центров получили напоминание. */
    remindCenters: build.mutation<number, number[]>({
      query: ids => ({ url: '/centers/remind', method: 'POST', body: { ids } }),
      transformResponse: (r: { updated: number }) => r.updated,
      invalidatesTags: [...centerListTags],
    }),
    /** Счёт на продление; подписка продлится после оплаты. */
    issueRenewalInvoice: build.mutation<CenterDto, number>({
      query: centerId => ({ url: `/centers/${centerId}/invoice`, method: 'POST' }),
      invalidatesTags: (_r, _e, centerId) => [...centerMoneyTags(centerId)],
    }),
  }),
})

export const { useGetExpiringQuery, useRemindCentersMutation, useIssueRenewalInvoiceMutation } = expiringApi
