import { devices, expect, test } from '@playwright/test'

// Телефон (375 px): меню-шторка, карточки реестра, панель финансов без горизонтальной прокрутки
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })

const noHorizontalScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth

test('телефон: меню, карточки реестра, финансы центра', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform')
  await expect(page.locator('aside').first()).toBeHidden() // постоянного сайдбара нет
  expect(await page.evaluate(noHorizontalScroll)).toBe(true)

  await page.getByRole('button', { name: 'Открыть меню' }).click()
  const drawer = page.getByRole('dialog', { name: 'Основное меню' })
  await drawer.getByRole('link', { name: 'Все центры' }).click()
  await expect(page).toHaveURL(/\/platform\/centers$/)
  await expect(drawer).toBeHidden()

  const card = page.getByRole('article', { name: 'Умед Плюс' })
  await expect(card).toContainText('В овердрафте')
  expect(await page.evaluate(noHorizontalScroll)).toBe(true)

  await card.getByRole('button', { name: 'Действия: Умед Плюс' }).click()
  await page.getByRole('menuitem', { name: /Баланс и овердрафт/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Финансы центра' })
  await expect(sheet.getByRole('table', { name: 'Журнал операций' })).toBeVisible()
  const box = await sheet.boundingBox()
  expect(box && box.width).toBeLessThanOrEqual(375)

  expect(errors).toEqual([])
})
