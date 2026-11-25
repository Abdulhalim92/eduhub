import { expect, test } from '@playwright/test'

test('главная: данные из api, график с подсказкой, меню строки ведёт в реестр', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform')
  const attention = page.getByRole('region', { name: 'Требует внимания' })
  await expect(attention.getByText('4 новых филиала ожидают проверки')).toBeVisible()
  await expect(attention.getByLabel('Всего: 22')).toBeVisible()

  const activity = page.getByRole('region', { name: 'Активность центров' })
  await expect(activity.getByRole('row')).toHaveCount(6) // шапка + 5 центров

  // 11 столбцов: прогнозный — светлее и с пунктирной обводкой
  const bars = page.locator('.recharts-bar-rectangle path')
  await expect(bars).toHaveCount(11)
  await expect(bars.nth(10)).toHaveAttribute('stroke-dasharray', '3 2')
  await bars.nth(6).hover()
  await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('6 100')
  await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Июл')

  await activity.getByRole('button', { name: 'Действия: Дониш' }).click()
  await page.getByRole('menuitem', { name: /Открыть в реестре центров/ }).click()
  await expect(page).toHaveURL(/\/platform\/centers\?q=%D0%94%D0%BE%D0%BD%D0%B8%D1%88$/)

  expect(errors).toEqual([])
})
