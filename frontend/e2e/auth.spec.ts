import { expect, test } from '@playwright/test'

test('вход по паролю демо-доступом: смена временного пароля и кабинет центра', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/login')
  await page.getByRole('tab', { name: 'По логину и паролю' }).click()
  await page.getByRole('button', { name: 'Подставить' }).click()
  await page.getByRole('button', { name: 'Войти' }).click()
  await expect(page.getByRole('heading', { name: 'Смените временный пароль' })).toBeVisible()
  await page.getByLabel('Новый пароль').fill('MyCenter2026')
  await page.getByLabel('Повторите пароль').fill('MyCenter2026')
  await page.getByRole('button', { name: 'Сохранить и войти' }).click()
  await expect(page).toHaveURL(/\/center\/profile\?center=1$/)
  await expect(page.locator('aside').first()).toContainText('Центр Перспектива')
  expect(errors).toEqual([])
})

test('вход по SMS-коду с выбором центра, затем заявка центра', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Подставить' }).click()
  await page.getByRole('button', { name: 'Получить код' }).click()
  const code = (await page.getByText(/Демо: SMS не отправляется/).textContent())!.match(/\d{6}/)![0]
  await page.getByLabel('Код из SMS').fill(code)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.getByRole('button', { name: 'Войти: Центр Перспектива, Владелец центра' }).click()
  await expect(page).toHaveURL(/\/center\/profile\?center=1$/)

  await page.goto('/login')
  await page.getByRole('link', { name: 'Оставить заявку на подключение' }).click()
  await page.getByLabel(/Название центра/).fill('Академия Рахш')
  await page.getByLabel(/Город/).selectOption('Бохтар')
  await page.getByLabel(/Основное направление/).selectOption('Шахматы')
  await page.getByLabel(/Ваше имя и фамилия/).fill('Рахим Саидов')
  await page.getByLabel(/Телефон/).fill('+992 91 222 33 44')
  await page.getByRole('checkbox', { name: /обработку персональных данных/ }).check()
  await page.getByRole('button', { name: 'Отправить заявку' }).click()
  await expect(page.getByRole('heading', { name: /^Заявка APP-\d+ отправлена$/ })).toBeVisible()
})
