/* Вход SuperAdmin в кабинет центра (PLT-CTR-050): без записи в журнале аудита вход не выполняется (NFR-SEC-030). */
import { baseApi } from '@/api/baseApi'

export const supportApi = baseApi.injectEndpoints({
  endpoints: build => ({
    enterSupport: build.mutation<{ ok: true }, number>({
      query: centerId => ({ url: '/support/sessions', method: 'POST', body: { centerId } }),
    }),
  }),
})

export const { useEnterSupportMutation } = supportApi
