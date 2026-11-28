import { expect, test } from '@playwright/test'

// Цвета — из src/styles/theme.css (палитра прототипа)
const SIDEBAR_BG = 'rgb(45, 56, 74)' // #2D384A
const CANVAS_BG = 'rgb(225, 234, 243)' // #E1EAF3

test('кабинет платформы: тёмный сайдбар, фон, шрифт Inter, переход по меню', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/platform$/)
  await expect(page).toHaveTitle('Главная · ЛИНИЯ')

  const sidebar = page.locator('aside')
  await expect(sidebar).toHaveCSS('background-color', SIDEBAR_BG)
  await expect(page.locator('html')).toHaveCSS('background-color', CANVAS_BG)
  expect(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('13px "Inter Variable"', 'Линия')))).toBe(true)

  const nav = page.getByRole('navigation', { name: 'Основное меню' })
  await nav.getByRole('link', { name: 'Все центры' }).click()
  await expect(page).toHaveURL(/\/platform\/centers$/)
  await expect(page.getByRole('navigation', { name: 'Навигационная цепочка' })).toContainText('Все центры')
  // активный пункт — светлая подложка, неактивный — прозрачный
  await expect(nav.getByRole('link', { name: 'Все центры' })).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(nav.getByRole('link', { name: 'Главная' })).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
})

test('прямая ссылка на вложенный экран открывается после перезагрузки', async ({ page }) => {
  await page.goto('/center/groups/3')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Группа')
  await expect(page.getByRole('navigation', { name: 'Основное меню' }).getByRole('link', { name: 'Группы' })).toHaveAttribute('aria-current', 'page')
})
