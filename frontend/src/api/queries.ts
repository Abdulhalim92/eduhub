/* Хуки запросов TanStack Query поверх api. Ключи собраны в одном месте, чтобы после мутаций инвалидировать нужные. */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CentersListParams } from './contract'
import { api } from './index'

export const queryKeys = {
  dictionaries: ['dictionaries'] as const,
  attention: ['platform', 'attention'] as const,
  centers: ['centers'] as const,
  centersList: (p: CentersListParams) => ['centers', 'list', p] as const,
  recentActivity: (limit: number) => ['centers', 'recent-activity', { limit }] as const,
  finance: (centerId: number) => ['finance', centerId] as const,
  cabinetCenters: ['cabinet', 'centers'] as const,
  sms: ['sms'] as const,
  smsPackages: ['sms', 'packages'] as const,
  planChangeAll: ['plan-change'] as const,
  planChange: (centerId: number) => ['plan-change', centerId] as const,
  invoiceAll: ['invoice'] as const,
  invoice: (id: string) => ['invoice', id] as const,
}

/** Диалог смены тарифа; null — закрыт. */
export const usePlanChangeInfo = (centerId: number | null) =>
  useQuery({ queryKey: queryKeys.planChange(centerId ?? 0), queryFn: () => api.centers.planChangeInfo(centerId!), enabled: centerId !== null })

/** Счёт для диалогов оплаты и отмены; null — закрыт. */
export const useInvoice = (id: string | null) =>
  useQuery({ queryKey: queryKeys.invoice(id ?? ''), queryFn: () => api.billing.get(id!), enabled: id !== null })

export const useSmsPackages = () => useQuery({ queryKey: queryKeys.smsPackages, queryFn: () => api.sms.packages() })

/** Центры для кабинета: тариф и статус меняются из кабинета платформы — данные считаются свежими 30 с, как остальные. */
export const useCabinetCenters = () =>
  useQuery({ queryKey: queryKeys.cabinetCenters, queryFn: () => api.cabinet.profileCenters() })

/** Панель «Финансы центра»; null — панель закрыта, запрос не идёт. */
export const useFinance = (centerId: number | null) =>
  useQuery({
    queryKey: queryKeys.finance(centerId ?? 0),
    queryFn: () => api.finance.get(centerId!),
    enabled: centerId !== null,
  })

/** Справочники меняются редко — грузятся один раз за сеанс. */
export const useDictionaries = () =>
  useQuery({ queryKey: queryKeys.dictionaries, queryFn: () => api.dictionaries.get(), staleTime: Infinity })

export const useAttention = () =>
  useQuery({ queryKey: queryKeys.attention, queryFn: () => api.platform.attention() })

/** Реестр центров. При смене фильтра или страницы прежняя выдача остаётся на экране, пока не придёт новая. */
export const useCentersList = (params: CentersListParams) =>
  useQuery({ queryKey: queryKeys.centersList(params), queryFn: () => api.centers.list(params), placeholderData: keepPreviousData })

export const useRecentActivity = (limit = 5) =>
  useQuery({ queryKey: queryKeys.recentActivity(limit), queryFn: () => api.centers.recentActivity({ limit }) })
