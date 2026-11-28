import { describe, expect, it } from 'vitest'
import { pageCount, pagerNumbers } from './pager'

describe('пагинация', () => {
  it('число страниц: минимум одна', () => {
    expect(pageCount(0)).toBe(1)
    expect(pageCount(10)).toBe(1)
    expect(pageCount(11)).toBe(2)
    expect(pageCount(29)).toBe(3)
  })

  it.each([
    [1, 3, [1, 2, 3]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 20, [1, 2, 0, 19, 20]],
    [3, 20, [1, 2, 3, 4, 0, 19, 20]],
    [6, 20, [1, 2, 0, 5, 6, 7, 0, 19, 20]],
    [20, 20, [1, 2, 0, 19, 20]],
  ])('страница %i из %i → %j (0 — многоточие)', (page, pages, expected) => {
    expect(pagerNumbers(page, pages)).toEqual(expected)
  })
})
