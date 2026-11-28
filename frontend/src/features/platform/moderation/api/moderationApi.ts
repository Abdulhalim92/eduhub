/* «Модерация каталога» (PLT-MOD-010…030): очередь заявок филиалов, решение, возврат в очередь. Решения пишутся в журнал аудита на сервере. */
import { baseApi } from '@/api/baseApi'
import type { ModerationDecisionPayload, ModerationList, ModerationRequest, ModerationTab } from './types'

export const moderationApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getModeration: build.query<ModerationList, ModerationTab>({
      query: status => ({ url: '/moderation', params: { status } }),
      providesTags: ['Moderation'],
    }),
    decideModeration: build.mutation<ModerationRequest, { id: number } & ModerationDecisionPayload>({
      query: ({ id, ...body }) => ({ url: `/moderation/${id}/decision`, method: 'POST', body }),
      invalidatesTags: ['Moderation', 'Attention'],
    }),
    requeueModeration: build.mutation<ModerationRequest, number>({
      query: id => ({ url: `/moderation/${id}/requeue`, method: 'POST' }),
      invalidatesTags: ['Moderation', 'Attention'],
    }),
  }),
})

export const { useGetModerationQuery, useDecideModerationMutation, useRequeueModerationMutation } = moderationApi
