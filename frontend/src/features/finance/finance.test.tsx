/* Финансы центра из реестра: панель (PLT-BAL-010/020/060), пополнение (030), лимит овердрафта (050), оплата счёта с баланса (040).
   mock живёт в памяти модуля: изменения из ранних тестов видны поздним, поэтому каждый тест работает со своим центром. */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, apiConfig } from '@/api'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const main = () => screen.getByRole('main')
const rowOf = (name: string) => within(main()).getAllByRole('row').find(r => within(r).queryByText(name))!

type User = ReturnType<typeof userEvent.setup>

async function openRegistry() {
  const user = userEvent.setup()
  renderRoute('/platform/centers?q=')
  await within(main()).findByText('Центр Перспектива')
  return user
}
async function menu(user: User, center: string, item: RegExp) {
  await user.click(within(rowOf(center)).getByRole('button', { name: `Действия: ${center}` }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}
async function openSheet(user: User, center: string) {
  await menu(user, center, /Баланс и овердрафт/)
  const sheet = await screen.findByRole('dialog', { name: 'Финансы центра' })
  await within(sheet).findByRole('region', { name: 'Баланс на платформе' })
  expect(sheet).toHaveAccessibleDescription(center) // данные именно этого центра
  return sheet
}
const dialog = (name: string) => screen.findByRole('dialog', { name })

afterEach(() => {
  vi.restoreAllMocks()
  apiConfig.latencyMs = 0
})

describe('панель «Финансы центра»', () => {
  it('меню строки реестра: баланс и лимит в подсказке, пополнение', async () => {
    const user = await openRegistry()
    await user.click(within(rowOf('Умед Плюс')).getByRole('button', { name: 'Действия: Умед Плюс' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(i => norm(i.textContent))).toEqual([
      'Баланс и овердрафт…Баланс на платформе -150 сомони · лимит овердрафта 300 сомони',
      'Пополнить баланс…Деньги уже поступили вне системы',
      'Начислить пакет SMS…SMS-баланс 310 шт',
      'Сменить тариф…Сейчас «Базовый»; смена — через счёт',
      'Настройка модулейМодули и лимиты тарифа, доступ администратора',
    ])
  })

  it('баланс, доступно к расходу, овердрафт и журнал операций (PLT-BAL-010, 020, 060)', async () => {
    const user = await openRegistry()
    const sheet = await openSheet(user, 'Умед Плюс')
    expect(norm(sheet.textContent)).toContain('Душанбе · Фарида Рахимова · тариф «Базовый»')
    const card = within(sheet).getByRole('region', { name: 'Баланс на платформе' })
    expect(norm(card.textContent)).toContain('-150 сомони')
    expect(card).toHaveTextContent('В овердрафте')
    expect(norm(card.textContent)).toContain('Доступно к расходу150 сомони') // BAL-020: -150 при лимите 300
    expect(norm(card.textContent)).toContain('использовано 150 сомони из 300 сомони · 50%')

    const ledger = within(sheet).getByRole('table', { name: 'Журнал операций' })
    const rows = within(ledger).getAllByRole('row').slice(1).map(r => norm(r.textContent))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatch(/СписаниеСписание с баланса на платформе · Подписка \(1 мес\)−350 сомони-150 сомони$/)
    expect(rows[1]).toMatch(/ПополнениеБезнал \(Р\/С\) · ПП № 105\+200 сомони200 сомони$/)
  })

  it('«Овердрафт почти исчерпан» при использовании ≥ 80 %; без лимита — «не предусмотрен»', async () => {
    const user = await openRegistry()
    let sheet = await openSheet(user, 'English Hub')
    expect(within(sheet).getByRole('region', { name: 'Баланс на платформе' })).toHaveTextContent('Овердрафт почти исчерпан')
    await user.click(within(sheet).getByRole('button', { name: 'Закрыть' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    sheet = await openSheet(user, 'Math Lab')
    expect(sheet).toHaveTextContent('не предусмотрен')
    expect(sheet).toHaveTextContent('Центр не может уйти в минус')
    expect(within(sheet).getByRole('region', { name: 'Баланс на платформе' })).toHaveTextContent('Баланс положительный')
  })

  it('ошибка загрузки панели: сообщение и «Повторить»', async () => {
    const user = await openRegistry()
    vi.spyOn(api.finance, 'get').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await menu(user, 'Рушд', /Баланс и овердрафт/)
    const sheet = await dialog('Финансы центра')
    const alert = await within(sheet).findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }))
    await within(sheet).findByRole('region', { name: 'Баланс на платформе' })
    expect(sheet).toHaveAccessibleDescription('Рушд')
  })
})

describe('пополнение баланса (PLT-BAL-030)', () => {
  it('ошибки сервера под полями, фокус на первом; диалог не закрывается (критерий 1)', async () => {
    const user = await openRegistry()
    await menu(user, 'Центр Перспектива', /Пополнить баланс/)
    const d = await dialog('Пополнить баланс на платформе')
    await user.click(within(d).getByRole('button', { name: 'Пополнить баланс' }))

    expect(await within(d).findByText('Укажите № платёжного поручения')).toBeInTheDocument()
    expect(within(d).getByText('Сумма — целое число сомони от 1 до 1 000 000')).toBeInTheDocument()
    expect(within(d).getByText('Подтвердите, что деньги действительно поступили')).toBeInTheDocument()
    const reference = within(d).getByLabelText(/№ платёжного поручения/)
    expect(reference).toHaveFocus()
    expect(reference).toHaveAttribute('aria-invalid', 'true')

    // исправленное поле теряет ошибку сразу
    await user.type(reference, 'ПП № 9')
    expect(within(d).queryByText('Укажите № платёжного поручения')).toBeNull()

    // дата в будущем
    const date = within(d).getByLabelText(/Дата поступления/)
    await user.clear(date)
    await user.type(date, '2999-01-01')
    await user.click(within(d).getByRole('button', { name: 'Пополнить баланс' }))
    expect(await within(d).findByText('Дата поступления не может быть в будущем')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Пополнить баланс на платформе' })).toBeInTheDocument()
  })

  it('способ оплаты меняет подпись документа', async () => {
    const user = await openRegistry()
    await menu(user, 'Центр Перспектива', /Пополнить баланс/)
    const d = await dialog('Пополнить баланс на платформе')
    expect(within(d).getByRole('radio', { name: /Безнал/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(d).getByRole('radio', { name: /Наличные/ }))
    expect(within(d).getByRole('radio', { name: /Наличные/ })).toHaveAttribute('aria-checked', 'true')
    expect(within(d).getByLabelText(/№ приходного кассового ордера/)).toHaveAttribute('placeholder', 'Например, ПКО № 45')
  })

  it('успех: предпросмотр с погашением овердрафта, тост, новый баланс в реестре и журнале аудита (критерий 2)', async () => {
    const user = await openRegistry()
    await menu(user, 'Умед Плюс', /Пополнить баланс/)
    const d = await dialog('Пополнить баланс на платформе')
    expect(d).toHaveTextContent('Введите сумму, чтобы увидеть баланс после пополнения.')
    await user.type(within(d).getByLabelText(/№ платёжного поручения/), 'ПП № 77')
    await user.type(within(d).getByLabelText(/Сумма, сомони/), '500')
    expect(norm(d.textContent)).toContain('Баланс на платформе: -150 сомони → 350 сомони. Из них 150 сомони погасят использованный овердрафт.')
    await user.click(within(d).getByRole('checkbox', { name: /деньги фактически поступили/ }))
    await user.click(within(d).getByRole('button', { name: 'Пополнить баланс' }))

    expect(await screen.findByText(/Баланс на платформе «Умед Плюс» пополнен: 350/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(norm(rowOf('Умед Плюс').textContent)).toContain('350 сомонидоступно 650 сомони'))
    expect(rowOf('Умед Плюс')).not.toHaveTextContent('В овердрафте')
    expect(within(main()).getByRole('button', { name: /^В овердрафте · 3$/ })).toBeInTheDocument()

    const audit = await mock.audit.list({})
    expect(audit.items[0]).toMatchObject({ action: 'balance.topup', entity: { name: 'Умед Плюс' }, before: { balance: -150 }, after: { balance: 350 } })
  })

  it('пока запрос идёт, кнопка заблокирована (нет двойной отправки)', async () => {
    const user = await openRegistry()
    await menu(user, 'Рушд', /Пополнить баланс/)
    const d = await dialog('Пополнить баланс на платформе')
    await user.type(within(d).getByLabelText(/№ платёжного поручения/), 'ПП № 5')
    await user.type(within(d).getByLabelText(/Сумма, сомони/), '100')
    await user.click(within(d).getByRole('checkbox', { name: /деньги фактически поступили/ }))
    apiConfig.latencyMs = 80
    const spy = vi.spyOn(api.finance, 'topUp')
    await user.click(within(d).getByRole('button', { name: 'Пополнить баланс' }))
    const busy = within(d).getByRole('button', { name: 'Пополняем…' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('сбой сети: тост с ошибкой, диалог остаётся открытым', async () => {
    const user = await openRegistry()
    await menu(user, 'Центр Перспектива', /Пополнить баланс/)
    const d = await dialog('Пополнить баланс на платформе')
    vi.spyOn(api.finance, 'topUp').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await user.click(within(d).getByRole('button', { name: 'Пополнить баланс' }))
    expect(await screen.findByText('Не удалось выполнить операцию. Проверьте соединение и повторите.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Пополнить баланс на платформе' })).toBeInTheDocument()
  })
})

describe('лимит овердрафта (PLT-BAL-050)', () => {
  it('ниже использованного и короткая причина — отказ; затем сохранение с записью «было → стало»', async () => {
    const user = await openRegistry()
    const sheet = await openSheet(user, 'English Hub')
    await user.click(within(sheet).getByRole('button', { name: 'Изменить лимит овердрафта…' }))
    const d = await dialog('Лимит овердрафта')
    const limit = within(d).getByLabelText(/Новый лимит, сомони/)
    expect(limit).toHaveValue(500)
    expect(d).toHaveTextContent('Не ниже уже использованных 420 сомони.')

    await user.click(within(d).getByRole('button', { name: '300' }))
    await user.type(within(d).getByLabelText(/Причина изменения/), 'abc')
    await user.click(within(d).getByRole('button', { name: 'Сохранить лимит' }))
    expect(await within(d).findByText(/Центр уже использовал 420 сомони овердрафта: лимит не может быть ниже/)).toBeInTheDocument()
    expect(within(d).getByText('Укажите причину (минимум 5 символов)')).toBeInTheDocument()

    await user.click(within(d).getByRole('button', { name: '1000' }))
    expect(norm(d.textContent)).toContain('Доступно к расходу: 80 сомони → 580 сомони (лимит вырастет на 500 сомони)')
    await user.type(within(d).getByLabelText(/Причина изменения/), ' — оплата по графику')
    await user.click(within(d).getByRole('button', { name: 'Сохранить лимит' }))

    expect(await screen.findByText(/Лимит овердрафта «English Hub»: 1 000 сомони/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Лимит овердрафта' })).toBeNull())
    const card = within(screen.getByRole('dialog', { name: 'Финансы центра' })).getByRole('region', { name: 'Баланс на платформе' })
    await waitFor(() => expect(norm(card.textContent)).toContain('использовано 420 сомони из 1 000 сомони · 42%'))
    expect(card).toHaveTextContent('В овердрафте')
    expect(card).not.toHaveTextContent('почти исчерпан')

    const audit = await mock.audit.list({})
    expect(audit.items[0]).toMatchObject({ action: 'overdraft.changed', before: { overdraftLimit: 500 }, after: { overdraftLimit: 1000 } })
  })

  it('тот же лимит — «Лимит не изменился»', async () => {
    const user = await openRegistry()
    const sheet = await openSheet(user, 'Sitora Kids')
    await user.click(within(sheet).getByRole('button', { name: 'Изменить лимит овердрафта…' }))
    const d = await dialog('Лимит овердрафта')
    await user.type(within(d).getByLabelText(/Причина изменения/), 'Проверка правила')
    await user.click(within(d).getByRole('button', { name: 'Сохранить лимит' }))
    expect(await within(d).findByText('Лимит не изменился')).toBeInTheDocument()
  })
})

describe('оплата счёта с баланса (PLT-BAL-040)', () => {
  it('не хватает средств — кнопка недоступна с пояснением; после пополнения — списание с подтверждением', async () => {
    const user = await openRegistry()
    const sheet = await openSheet(user, 'Alpha School')
    const invoices = within(sheet).getByRole('region', { name: 'Открытые счета' })
    expect(norm(invoices.textContent)).toContain('Курс: Подготовка к НЦТ')
    expect(invoices).toHaveTextContent('Недостаточно средств (с учётом овердрафта)')
    expect(within(invoices).getByRole('button', { name: 'Списать с баланса' })).toBeDisabled()

    // пополнение поверх панели
    await user.click(within(sheet).getByRole('button', { name: 'Пополнить баланс…' }))
    const top = await dialog('Пополнить баланс на платформе')
    await user.type(within(top).getByLabelText(/№ платёжного поручения/), 'ПП № 300')
    await user.type(within(top).getByLabelText(/Сумма, сомони/), '1000')
    await user.click(within(top).getByRole('checkbox', { name: /деньги фактически поступили/ }))
    await user.click(within(top).getByRole('button', { name: 'Пополнить баланс' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Пополнить баланс на платформе' })).toBeNull())

    const payBtn = within(sheet).getByRole('button', { name: 'Списать с баланса' })
    await waitFor(() => expect(payBtn).toBeEnabled())
    await user.click(payBtn)
    const confirm = await screen.findByRole('alertdialog', { name: 'Списать с баланса на платформе?' })
    expect(norm(confirm.textContent)).toContain('Баланс на платформе: 1 120 сомони → -380 сомони')
    expect(confirm).toHaveTextContent('Баланс уйдёт в минус: будет использован овердрафт.')
    await user.click(within(confirm).getByRole('button', { name: /^Списать 1\s500 сомони$/ }))

    expect(await screen.findByText('Счёт INV-1043 оплачен с баланса на платформе')).toBeInTheDocument()
    await waitFor(() => expect(within(sheet).queryByRole('region', { name: 'Открытые счета' })).toBeNull())
    const first = within(within(sheet).getByRole('table', { name: 'Журнал операций' })).getAllByRole('row')[1]
    expect(norm(first.textContent)).toContain('Списание с баланса на платформе · Курс: Подготовка к НЦТ−1 500 сомони-380 сомони')
  })
})
