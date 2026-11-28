/* Справочники (GET /dictionaries): города, направления, менеджеры, способы оплаты, активные тарифы. Меняются редко — кеш на весь сеанс. */
import { baseApi } from '@/api/baseApi'
import type { Dictionaries } from './types'

export const dictionariesApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getDictionaries: build.query<Dictionaries, void>({
      query: () => '/dictionaries',
      providesTags: ['Dictionaries'],
      keepUnusedDataFor: 24 * 60 * 60,
    }),
  }),
})

export const { useGetDictionariesQuery } = dictionariesApi
