import { devices, expect, test } from '@playwright/test'

// «Модерация каталога» (PLT-MOD) и «Центры у лимита» (PLT-TRF-040): переход из меню, ключевое действие, без ошибок в консоли
test('модерация: публикация заявки после подтверждения пина', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform')
  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('link', { name: /Модерация каталога/ }).click()
  await expect(page).toHaveURL(/\/platform\/moderation$/)
  const main = page.getByRole('main')
  await expect(main.getByRole('button', { name: 'Ожидают · 4' })).toBeVisible()
  await main.getByRole('checkbox', { name: /Я проверил\(а\) координаты/ }).check()
  await main.getByRole('button', { name: 'Одобрить и опубликовать' }).click()
  await expect(page.getByText('Филиал «Сино» (Центр Перспектива) опубликован в каталоге')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Ожидают · 3' })).toBeVisible()
  expect(errors).toEqual([])
})

test('центры у лимита: предложение и счёт на переход', async ({ page }) => {
  await page.goto('/platform/limits')
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Открыть карточку: Умед Плюс' }).click()
  await main.getByRole('button', { name: 'Отправить предложение' }).click()
  await expect(page.getByText('Предложение отправлено: Умед Плюс → «Про»')).toBeVisible()
  await main.getByRole('button', { name: 'Выставить счёт на «Про»…' }).click()
  const d = page.getByRole('dialog', { name: 'Смена тарифа · Умед Плюс' })
  await expect(d.getByLabel(/Причина смены/)).toHaveValue(/^Лимит «Сотрудники» исчерпан: 9 из 10 \(90%\)$/)
  await d.getByRole('button', { name: 'Выставить счёт на 900 сомони' }).click()
  await expect(d.getByRole('region', { name: /ожидает оплаты/ })).toBeVisible()
})

test.describe('телефон', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent })
  test('карточка центра у лимита и заявка модерации открываются панелью без горизонтальной прокрутки', async ({ page }) => {
    for (const [path, open, title] of [
      ['/platform/limits', 'Открыть карточку: Zebo Lingua', 'Zebo Lingua'],
      ['/platform/moderation', 'Открыть заявку: Дониш — Главный филиал', 'Дониш — Главный филиал'],
    ]) {
      await page.goto(path)
      await page.getByRole('main').getByRole('button', { name: open }).click()
      const sheet = page.getByRole('dialog', { name: title })
      await expect(sheet).toBeVisible()
      expect(await sheet.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    }
  })
})
