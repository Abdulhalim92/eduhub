/* SMS-пакеты (PLT-SMS): каталог и начисление центру (с баланса, по документу или бонусом). */
import { baseApi, centerMoneyTags } from '@/api/baseApi'
import type { SmsAccruePayload, SmsPackage, SmsSale } from './types'

export const smsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getSmsPackages: build.query<SmsPackage[], void>({
      query: () => '/sms/packages',
      transformResponse: (r: { items: SmsPackage[] }) => r.items,
      providesTags: ['Sms'],
    }),
    accrueSms: build.mutation<SmsSale, SmsAccruePayload>({
      query: body => ({ url: '/sms/sales', method: 'POST', body }),
      invalidatesTags: (_r, _e, { centerId }) => [...centerMoneyTags(centerId)],
    }),
  }),
})

export const { useGetSmsPackagesQuery, useAccrueSmsMutation } = smsApi
