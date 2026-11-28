import { devices, expect, test } from '@playwright/test'

// «Требует внимания»: истекающие подписки (PLT-DSH-030) и риск оттока (PLT-DSH-020) — переход из меню, без ошибок в консоли
test('меню → истекающие подписки → счёт на продление', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform')
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('link', { name: /Истекают подписки/ }).click()
  await expect(page).toHaveURL(/\/platform\/expiring$/)
  const main = page.getByRole('main')
  await expect(main.getByRole('row', { name: /Бахор/ })).toContainText('просрочено 2 дня')
  await main.getByRole('row', { name: /Рушд/ }).getByRole('button', { name: 'Выставить счёт' }).click()
  await expect(main.getByRole('row', { name: /Рушд/ })).toContainText(/Счёт INV-\d+/)
  await expect(main.getByRole('row', { name: /Рушд/ }).getByRole('button', { name: 'Подтвердить оплату' })).toBeVisible()
  expect(errors).toEqual([])
})

test('риск оттока: менеджер и контакт', async ({ page }) => {
  await page.goto('/platform/churn')
  const main = page.getByRole('main')
  const row = main.getByRole('row', { name: /English Hub/ })
  await row.getByRole('combobox', { name: 'Менеджер центра English Hub' }).selectOption('Нигора Р.')
  await expect(page.getByText('Менеджер Нигора Р. назначен: English Hub')).toBeVisible()
  await row.getByRole('button', { name: 'Связались' }).click()
  await expect(row).toContainText('Контакт сегодня')
  await expect(row.getByRole('button', { name: 'Контакт есть' })).toBeDisabled()
})

test.describe('телефон', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })
  for (const path of ['/platform/expiring', '/platform/churn'])
    test(`${path}: карточки без горизонтальной прокрутки`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main').getByRole('article').first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
})
