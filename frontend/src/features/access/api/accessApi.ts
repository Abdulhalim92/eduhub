/* Данные для входа владельца центра (SYS-ACC-020, BR-025): пароль показывается один раз, в журнал пишется без пароля. */
import { baseApi } from '@/api/baseApi'
import type { IssuedCredentials } from './types'

export const accessApi = baseApi.injectEndpoints({
  endpoints: build => ({
    issueAdminAccess: build.mutation<IssuedCredentials, { centerId: number; reason: string }>({
      query: ({ centerId, reason }) => ({ url: `/centers/${centerId}/admin-access`, method: 'POST', body: { reason } }),
    }),
  }),
})

export const { useIssueAdminAccessMutation } = accessApi
