/* Пагинация (прототип: components/pager.js). 10 записей на странице — docs/design/ui-principles.md. */
export const PAGE_SIZE = 10

export const pageCount = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size))

/** Компактный набор номеров: 1 2 … 5 [6] 7 … 19 20; 0 — многоточие. До 7 страниц — все номера. */
export function pagerNumbers(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const nums = [...new Set([1, 2, pages - 1, pages, page - 1, page, page + 1])]
    .filter(n => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  const out: number[] = []
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push(0)
    out.push(n)
  })
  return out
}
