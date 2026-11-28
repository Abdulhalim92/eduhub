import { expect, test } from '@playwright/test'

test('реестр: «Войти» открывает кабинет центра в режиме поддержки, выход возвращает в реестр', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform/centers')
  await page.getByRole('button', { name: 'Войти в кабинет центра Дониш (режим поддержки)' }).click()
  await expect(page).toHaveURL(/\/center\/profile\?center=4&support=1$/)
  const banner = page.getByRole('region', { name: 'Режим поддержки' })
  await expect(banner).toContainText('Вы вошли в кабинет: Дониш')
  await expect(page.locator('aside img')).toHaveAttribute('src', '/assets/centers/logo-4.svg')
  expect(await page.locator('aside img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0) // логотип загрузился

  await page.getByRole('navigation', { name: 'Основное меню' }).getByRole('link', { name: 'Группы' }).click()
  await expect(page).toHaveURL(/\/center\/groups\?center=4&support=1$/)
  await banner.getByRole('link', { name: /Выйти в кабинет платформы/ }).click()
  await expect(page).toHaveURL(/\/platform\/centers$/)

  expect(errors).toEqual([])
})

test('реестр: смена тарифа через счёт и подтверждение оплаты', async ({ page }) => {
  await page.goto('/platform/centers')
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Действия: Zebo Lingua' }).click()
  await page.getByRole('menuitem', { name: /Сменить тариф/ }).click()

  const d = page.getByRole('dialog', { name: 'Смена тарифа · Zebo Lingua' })
  await d.getByRole('radio', { name: /^Про/ }).click()
  await d.getByLabel(/Причина смены/).fill('Центру нужно больше филиалов')
  await d.getByRole('button', { name: 'Выставить счёт на 900 сомони' }).click()
  await expect(d.getByRole('region', { name: /ожидает оплаты/ })).toBeVisible()

  await d.getByRole('button', { name: 'Подтвердить оплату…' }).click()
  const pay = page.getByRole('dialog', { name: 'Подтвердить поступление оплаты' })
  await pay.getByLabel(/№ платёжного поручения/).fill('ПП № 41')
  await pay.getByRole('checkbox', { name: /деньги фактически поступили/ }).check()
  await pay.getByRole('button', { name: 'Подтвердить оплату' }).click()

  await expect(page.getByText(/тариф центра «Zebo Lingua» изменён на «Про»/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(main.getByRole('row').filter({ hasText: 'Zebo Lingua' }).getByRole('cell').nth(1)).toContainText('Про')
})
