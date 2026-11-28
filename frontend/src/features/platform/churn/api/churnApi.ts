/* «Риск оттока» (PLT-DSH-020): центры в зоне риска, менеджер, отметка о контакте. */
import { baseApi, centerListTags } from '@/api/baseApi'
import type { CenterDto } from '@/features/centers/api/types'
import type { ChurnFilter, ChurnList } from './types'

export const churnApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getChurn: build.query<ChurnList, ChurnFilter>({
      query: filter => ({ url: '/centers/churn', params: { filter } }),
      providesTags: [{ type: 'Center', id: 'LIST' }],
    }),
    /** null снимает менеджера. Список перечитывается и при ошибке — вернётся значение сервера. */
    setCenterManager: build.mutation<CenterDto, { centerId: number; manager: string | null }>({
      query: ({ centerId, manager }) => ({ url: `/centers/${centerId}/manager`, method: 'PUT', body: { manager } }),
      invalidatesTags: [...centerListTags],
    }),
    markCenterContacted: build.mutation<CenterDto, number>({
      query: centerId => ({ url: `/centers/${centerId}/contact`, method: 'POST' }),
      invalidatesTags: [...centerListTags],
    }),
  }),
})

export const { useGetChurnQuery, useSetCenterManagerMutation, useMarkCenterContactedMutation } = churnApi
