import { expect, test } from '@playwright/test'

test('реестр: переход с главной с фильтром, чип, страницы, «Назад» возвращает выдачу', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform')
  await page.getByRole('region', { name: 'Активность центров' }).getByRole('link', { name: 'Alpha School' }).click()
  const main = page.getByRole('main')
  await expect(main.getByRole('searchbox', { name: 'Поиск центров' })).toHaveValue('Alpha School')
  await expect(main.getByRole('table').getByRole('row')).toHaveCount(2) // шапка + центр

  await main.getByRole('button', { name: 'Сбросить фильтры' }).click()
  await expect(main.getByText(/Показано 1–10 из 29/)).toBeVisible()

  await main.getByRole('button', { name: 'Страница 3' }).click()
  await expect(main.getByText(/Показано 21–29 из 29/)).toBeVisible()
  await page.goBack()
  await expect(main.getByText(/Показано 1–10 из 29/)).toBeVisible()

  await main.getByRole('button', { name: /^В овердрафте · 4$/ }).click()
  await expect(page).toHaveURL(/filter=overdraft/)
  await expect(main.getByRole('table').getByRole('row')).toHaveCount(5)

  expect(errors).toEqual([])
})
