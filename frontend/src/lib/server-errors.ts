/* Ошибки валидации сервера → под поля формы (ui-principles: «Диалоги-формы показывают ошибки сервера под полями»).
   Источник истины — api: клиент правила не дублирует. Фокус — на первое поле с ошибкой в порядке формы. */
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api'

/** true — ошибки разложены по полям; false — показать общее сообщение (тостом). */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fieldOrder: Path<T>[]): boolean {
  if (!isApiError(e) || e.code !== 'VALIDATION') return false
  const fields = fieldOrder.filter(k => e.fields[k])
  fields.forEach((k, i) => setError(k, { type: 'server', message: e.fields[k] }, { shouldFocus: i === 0 }))
  return fields.length > 0
}
