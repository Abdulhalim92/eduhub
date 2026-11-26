/* Хуки запросов TanStack Query поверх api. Ключи собраны в одном месте, чтобы после мутаций инвалидировать нужные. */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CentersListParams, ChurnFilter, ModerationTab, NearLimitParams } from './contract'
import { api } from './index'

export const queryKeys = {
  dictionaries: ['dictionaries'] as const,
  attention: ['platform', 'attention'] as const,
  centers: ['centers'] as const,
  centersList: (p: CentersListParams) => ['centers', 'list', p] as const,
  recentActivity: (limit: number) => ['centers', 'recent-activity', { limit }] as const,
  // под префиксом centers: любая операция с центром (счёт, оплата, менеджер) обновляет и эти списки
  expiring: (withinDays: number) => ['centers', 'expiring', withinDays] as const,
  churn: (filter: ChurnFilter) => ['centers', 'churn', filter] as const,
  nearLimit: (p: NearLimitParams) => ['centers', 'near-limit', p] as const,
  moderationAll: ['moderation'] as const,
  moderation: (tab: ModerationTab) => ['moderation', tab] as const,
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

/** Истекающие подписки в окне 7 / 14 / 30 дней. */
export const useExpiring = (withinDays: number) =>
  useQuery({ queryKey: queryKeys.expiring(withinDays), queryFn: () => api.centers.expiring({ withinDays }), placeholderData: keepPreviousData })

/** Центры в зоне риска оттока. */
export const useChurn = (filter: ChurnFilter) =>
  useQuery({ queryKey: queryKeys.churn(filter), queryFn: () => api.centers.churn({ filter }), placeholderData: keepPreviousData })

/** Центры у лимита (PLT-TRF-040). */
export const useNearLimit = (params: NearLimitParams) =>
  useQuery({ queryKey: queryKeys.nearLimit(params), queryFn: () => api.plans.nearLimit(params), placeholderData: keepPreviousData })

/** Очередь модерации каталога (PLT-MOD-010). */
export const useModeration = (tab: ModerationTab) =>
  useQuery({ queryKey: queryKeys.moderation(tab), queryFn: () => api.moderation.list({ status: tab }), placeholderData: keepPreviousData })
