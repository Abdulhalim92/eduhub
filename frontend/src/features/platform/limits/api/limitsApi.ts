/* «Центры у лимита» (PLT-TRF-040, BR-021): кто у лимита, рекомендуемый тариф, предложение владельцу. */
import { baseApi, centerListTags } from '@/api/baseApi'
import type { NearLimitList, NearLimitParams } from './types'

export const limitsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getNearLimit: build.query<NearLimitList, NearLimitParams>({
      query: params => ({ url: '/plans/near-limit', params }),
      providesTags: [{ type: 'Center', id: 'LIST' }],
    }),
    /** Без planId — рекомендуемый тариф. Пропускаются заблокированные, без тарифа выше и с открытым счётом. */
    sendOffer: build.mutation<{ sent: number; skipped: number }, { ids: number[]; planId?: string }>({
      query: body => ({ url: '/centers/offers', method: 'POST', body }),
      invalidatesTags: [...centerListTags],
    }),
  }),
})

export const { useGetNearLimitQuery, useSendOfferMutation } = limitsApi
