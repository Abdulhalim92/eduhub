/* Счета платформы центру (PLT-BIL): карточка счёта, подтверждение оплаты, отмена, оплата с баланса, онлайн-оплата (демо). */
import { baseApi, centerMoneyTags } from '@/api/baseApi'
import type { ConfirmPaymentPayload, InvoiceDto } from './types'

/** После операции со счётом устаревает всё, где видны деньги и тариф его центра. */
const afterInvoice = (r: InvoiceDto | undefined) => (r ? [...centerMoneyTags(r.centerId)] : ['Invoice' as const])

export const billingApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getInvoice: build.query<InvoiceDto, string>({
      query: id => `/billing/invoices/${encodeURIComponent(id)}`,
      providesTags: ['Invoice'],
    }),
    /** Деньги поступили вне системы (BR-002): сумма должна совпасть со счётом. */
    confirmPayment: build.mutation<InvoiceDto, { invoiceId: string; payload: ConfirmPaymentPayload }>({
      query: ({ invoiceId, payload }) => ({ url: `/billing/invoices/${encodeURIComponent(invoiceId)}/confirm`, method: 'POST', body: payload }),
      invalidatesTags: afterInvoice,
    }),
    cancelInvoice: build.mutation<InvoiceDto, { invoiceId: string; reason: string }>({
      query: ({ invoiceId, reason }) => ({ url: `/billing/invoices/${encodeURIComponent(invoiceId)}/cancel`, method: 'POST', body: { reason } }),
      invalidatesTags: afterInvoice,
    }),
    /** В пределах «баланс + овердрафт» (BR-005). */
    payFromBalance: build.mutation<InvoiceDto, string>({
      query: invoiceId => ({ url: `/billing/invoices/${encodeURIComponent(invoiceId)}/pay-from-balance`, method: 'POST' }),
      invalidatesTags: afterInvoice,
    }),
    /** Демо платёжного шлюза: на проде оплату присылает webhook шлюза (INT-PAY-010). */
    payOnline: build.mutation<InvoiceDto, string>({
      query: invoiceId => ({ url: `/billing/invoices/${encodeURIComponent(invoiceId)}/pay-online`, method: 'POST' }),
      invalidatesTags: afterInvoice,
    }),
  }),
})

export const { useGetInvoiceQuery, useConfirmPaymentMutation, useCancelInvoiceMutation, usePayFromBalanceMutation, usePayOnlineMutation } = billingApi
