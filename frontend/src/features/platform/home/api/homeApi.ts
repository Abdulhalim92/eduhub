/* «Главная» (PLT-DSH-010): сводка «Требует внимания» и последние активные центры.
   Сводку читают и другие экраны (чипы реестра) — через этот же endpoint. */
import { baseApi } from '@/api/baseApi'
import type { CenterDto } from '@/features/centers/api/types'
import type { Attention } from './types'

export const homeApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getAttention: build.query<Attention, void>({
      query: () => '/platform/attention',
      providesTags: ['Attention'],
    }),
    getRecentActivity: build.query<CenterDto[], number>({
      query: limit => ({ url: '/centers/activity', params: { limit } }),
      transformResponse: (r: { items: CenterDto[] }) => r.items,
      providesTags: [{ type: 'Center', id: 'LIST' }],
    }),
  }),
})

export const { useGetAttentionQuery, useGetRecentActivityQuery } = homeApi
