/* Смена тарифа центра (PLT-TRF-020): варианты с расчётом, открытый счёт, история; заявка на смену (по умолчанию — счёт, BR-001). */
import { baseApi, centerMoneyTags } from '@/api/baseApi'
import type { PlanChangeInfo, PlanChangePayload, PlanChangeResult } from './types'

export const planChangeApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getPlanChange: build.query<PlanChangeInfo, number>({
      query: centerId => `/centers/${centerId}/plan-change`,
      providesTags: (_r, _e, centerId) => [{ type: 'PlanChange', id: centerId }],
    }),
    requestPlanChange: build.mutation<PlanChangeResult, { centerId: number; payload: PlanChangePayload }>({
      query: ({ centerId, payload }) => ({ url: `/centers/${centerId}/plan-change`, method: 'POST', body: payload }),
      invalidatesTags: (_r, _e, { centerId }) => [...centerMoneyTags(centerId)],
    }),
  }),
})

export const { useGetPlanChangeQuery, useRequestPlanChangeMutation } = planChangeApi
