/* Страницы без кабинета: вход по телефону и SMS-коду (SYS-ACC-030, основной), по логину и паролю со сменой временного (SYS-ACC-010, запасной),
   заявка центра (PLT-CTR-070). */
import { baseApi } from '@/api/baseApi'
import type { CenterApplication, CenterApplicationPayload, OtpRequested, OtpResult, OtpSessionResponse, OtpVerifyResponse, Session, SessionResponse, SignedIn } from './types'

/** Роли с веб-кабинетом центра. Пока сервер не присылает признак cabinet во входе по коду, решает этот список (ученик и родитель — в мобильном приложении). */
const WEB_CABINET_ROLES = ['owner', 'admin', 'center_admin']

/** Сессия входа по коду → та же сессия, что после входа по паролю: экран входа работает с одной формой. */
const otpSignedIn = (r: OtpSessionResponse): SignedIn => ({
  session: {
    login: r.phone,
    role: r.role,
    roleLabel: r.roleLabel ?? '',
    name: r.name,
    centerId: r.tenantId,
    centerName: r.tenantName,
    mustChange: false,
    cabinet: r.cabinet ?? WEB_CABINET_ROLES.includes(r.role),
  },
  token: r.token,
})

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
    /** Код на телефон. LOCKED — код уже отправлен (раз в минуту) или номер заблокирован после 5 неверных вводов. */
    requestOtp: build.mutation<OtpRequested, string>({
      query: phone => ({ url: '/auth/otp/request', method: 'POST', body: { phone } }),
    }),
    /** Неверный, просроченный и чужой код — один ответ UNAUTHORIZED «Неверный код». */
    verifyOtp: build.mutation<OtpResult, { phone: string; code: string }>({
      query: body => ({ url: '/auth/otp/verify', method: 'POST', body }),
      transformResponse: (r: OtpVerifyResponse): OtpResult =>
        r.session ? { kind: 'signedIn', signedIn: otpSignedIn(r.session) } : { kind: 'choose', selectToken: r.selectToken ?? '', memberships: r.memberships ?? [] },
    }),
    /** Выбор центра и роли — с токеном выбора из verifyOtp. */
    selectMembership: build.mutation<SignedIn, { selectToken: string; tenantId: number; role: string }>({
      query: ({ selectToken, tenantId, role }) => ({
        url: '/auth/membership',
        method: 'POST',
        headers: { Authorization: `Bearer ${selectToken}` },
        body: { tenantId, role },
      }),
      transformResponse: otpSignedIn,
    }),
    submitApplication: build.mutation<CenterApplication, CenterApplicationPayload>({
      query: body => ({ url: '/applications', method: 'POST', body }),
    }),
  }),
})

export const { useLoginMutation, useChangePasswordMutation, useRequestOtpMutation, useVerifyOtpMutation, useSelectMembershipMutation, useSubmitApplicationMutation } =
  authApi
