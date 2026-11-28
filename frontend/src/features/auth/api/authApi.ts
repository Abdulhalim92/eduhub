/* Страницы без кабинета: вход и смена временного пароля (SYS-ACC-010), восстановление по SMS-коду (SYS-ACC-030), заявка центра (PLT-CTR-070). */
import { baseApi } from '@/api/baseApi'
import type { CenterApplication, CenterApplicationPayload, ResetRequested, Session, SessionResponse, SignedIn } from './types'

const signedIn = ({ token, refreshToken: _refresh, ...session }: SessionResponse): SignedIn => ({ session: session as Session, token: token ?? null })

export const authApi = baseApi.injectEndpoints({
  endpoints: build => ({
    /** UNAUTHORIZED — одно сообщение для логина и пароля; LOCKED — 5 неудачных попыток; FORBIDDEN — доступ закрыт. */
    login: build.mutation<SignedIn, { login: string; password: string }>({
      query: body => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: signedIn,
    }),
    changePassword: build.mutation<SignedIn, { login: string; password: string; newPassword: string }>({
      query: body => ({ url: '/auth/password', method: 'POST', body }),
      transformResponse: signedIn,
    }),
    requestReset: build.mutation<ResetRequested, string>({
      query: login => ({ url: '/auth/reset', method: 'POST', body: { login } }),
    }),
    confirmReset: build.mutation<{ ok: true; login: string }, { login: string; code: string; newPassword: string }>({
      query: body => ({ url: '/auth/reset/confirm', method: 'POST', body }),
    }),
    submitApplication: build.mutation<CenterApplication, CenterApplicationPayload>({
      query: body => ({ url: '/applications', method: 'POST', body }),
    }),
  }),
})

export const { useLoginMutation, useChangePasswordMutation, useRequestResetMutation, useConfirmResetMutation, useSubmitApplicationMutation } = authApi
