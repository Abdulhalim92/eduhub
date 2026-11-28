/* «Все центры» (PLT-CTR-010): реестр с поиском, фильтрами и страницами — GET /centers. */
import { baseApi } from '@/api/baseApi'
import type { CentersList, CentersListParams, CentersPage } from './types'

export const centersApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getCenters: build.query<CentersPage, CentersListParams>({
      query: params => ({ url: '/centers', params }),
      // сводка над списком — плитки экрана; страница и размер страницы экрану не нужны (они в адресе)
      transformResponse: (r: CentersList): CentersPage => ({ items: r.items, total: r.total, platformTotal: r.platformTotal, tiles: r.meta }),
      providesTags: r => [{ type: 'Center', id: 'LIST' }, ...(r?.items.map(c => ({ type: 'Center' as const, id: c.id })) ?? [])],
    }),
  }),
})

export const { useGetCentersQuery } = centersApi
