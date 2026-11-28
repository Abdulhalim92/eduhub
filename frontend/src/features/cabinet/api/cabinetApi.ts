/* Кабинет центра: центры для переключателя (GET /cabinet/centers). Тариф и статус меняются из кабинета платформы — тег CabinetCenters. */
import { baseApi } from '@/api/baseApi'
import type { CabinetCenter } from './types'

export const cabinetApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getCabinetCenters: build.query<CabinetCenter[], void>({
      query: () => '/cabinet/centers',
      transformResponse: (r: { items: CabinetCenter[] }) => r.items,
      providesTags: ['CabinetCenters'],
    }),
  }),
})

export const { useGetCabinetCentersQuery } = cabinetApi
