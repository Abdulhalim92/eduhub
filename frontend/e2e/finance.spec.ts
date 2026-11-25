import { expect, test } from '@playwright/test'

test('финансы центра: панель из реестра, пополнение поверх панели, тост и новый баланс', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/platform/centers')
  const main = page.getByRole('main')
  await main.getByRole('button', { name: 'Действия: Умед Плюс' }).click()
  await page.getByRole('menuitem', { name: /Баланс и овердрафт/ }).click()

  const sheet = page.getByRole('dialog', { name: 'Финансы центра' })
  await expect(sheet.getByRole('region', { name: 'Баланс на платформе' })).toContainText('В овердрафте')
  await expect(sheet.getByRole('table', { name: 'Журнал операций' }).getByRole('row')).toHaveCount(3)

  await sheet.getByRole('button', { name: 'Пополнить баланс…' }).click()
  const top = page.getByRole('dialog', { name: 'Пополнить баланс на платформе' })
  await top.getByLabel(/№ платёжного поручения/).fill('ПП № 900')
  await top.getByLabel(/Сумма, сомони/).fill('500')
  await expect(top).toContainText('Из них 150 сомони погасят использованный овердрафт.')
  await top.getByRole('checkbox', { name: /деньги фактически поступили/ }).check()
  await top.getByRole('button', { name: 'Пополнить баланс' }).click()

  await expect(page.getByText(/Баланс на платформе «Умед Плюс» пополнен/)).toBeVisible()
  await expect(top).toBeHidden()
  await expect(sheet.getByRole('region', { name: 'Баланс на платформе' })).toContainText('Баланс положительный')
  await expect(sheet.getByRole('table', { name: 'Журнал операций' }).getByRole('row')).toHaveCount(4)

  await sheet.getByRole('button', { name: 'Закрыть' }).first().click()
  await expect(sheet).toBeHidden()
  await expect(main.getByRole('button', { name: /^В овердрафте · 3$/ })).toBeVisible()

  expect(errors).toEqual([])
})
