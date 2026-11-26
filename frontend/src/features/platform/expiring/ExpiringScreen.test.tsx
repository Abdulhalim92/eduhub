import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '@/test/render-route'

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const main = () => screen.getByRole('main')
const rows = () => within(within(main()).getByRole('table')).getAllByRole('row').slice(1)
const rowOf = (name: string) => rows().find(r => within(r).queryByText(name))!
const names = () => rows().map(r => norm(r.querySelector('td div')?.textContent))
const tile = (label: string) => norm(within(main()).getByText(label).parentElement?.textContent)
const loaded = () => within(main()).findByText('Бахор')

// Порядок тестов значим: mock живёт в памяти, напоминания и счета из ранних тестов видны в поздних.
describe('истекающие подписки (PLT-DSH-030)', () => {
  it('окно 14 дней: 7 центров по сроку, плитки, просроченный помечен', async () => {
    renderRoute('/platform/expiring')
    expect(within(main()).getByRole('heading', { level: 1 })).toHaveTextContent('Истекающие подписки')
    await loaded()
    expect(names()).toEqual(['Бахор', 'Zebo Lingua', 'Дониш', 'Sitora Kids', 'Indigo Academy', 'Умед Плюс', 'Рушд'])
    expect(tile('Истекают в ближайшие 7 дней')).toContain('5')
    expect(tile('Всего в выбранном окне')).toContain('7окно: 14 дн.')
    expect(tile('К получению за продления')).toContain('5 200 сомони')
    expect(tile('Счета выставлены')).toContain('0 из 7просрочено: 1')
    expect(rowOf('Бахор')).toHaveTextContent('просрочено 2 дня')
    expect(rowOf('Zebo Lingua')).toHaveTextContent('через 2 дня')
    expect(rowOf('Бахор')).toHaveTextContent('Не напоминали')
    expect(within(main()).getByRole('button', { name: '≤ 14 дней' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('окно 7 и 30 дней меняет выдачу и пишется в адрес; «Сбросить фильтры» возвращает 14', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/expiring')
    await loaded()
    await user.click(within(main()).getByRole('button', { name: '≤ 7 дней' }))
    await waitFor(() => expect(rows()).toHaveLength(5))
    expect(router.state.location.search).toBe('?days=7')
    await user.click(within(main()).getByRole('button', { name: '≤ 30 дней' }))
    await waitFor(() => expect(rows()).toHaveLength(9))
    await user.click(within(main()).getByRole('button', { name: 'Сбросить фильтры' }))
    await waitFor(() => expect(rows()).toHaveLength(7))
    expect(router.state.location.search).toBe('')
  })

  it('фильтр «Счёт: Выставлен» без счетов — пусто с кнопкой сброса', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/expiring?inv=yes')
    expect(await within(main()).findByText('Нет центров по выбранным фильтрам')).toBeInTheDocument()
    await user.click(within(main()).getAllByRole('button', { name: 'Сбросить фильтры' }).at(-1)!)
    expect(await loaded()).toBeInTheDocument()
  })

  it('напоминание одному центру: метка «Напоминание отправлено», пункт меню недоступен', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/expiring')
    await loaded()
    await user.click(within(rowOf('Дониш')).getByRole('button', { name: 'Действия: Дониш' }))
    await user.click(await screen.findByRole('menuitem', { name: /Отправить напоминание/ }))
    expect(await screen.findByText('Напоминание о продлении отправлено: Дониш')).toBeInTheDocument()
    await waitFor(() => expect(rowOf('Дониш')).toHaveTextContent('Напоминание отправлено'))
    await user.click(within(rowOf('Дониш')).getByRole('button', { name: 'Действия: Дониш' }))
    expect(await screen.findByRole('menuitem', { name: /Отправить напоминание/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('«Напомнить всем» — остальным шести; повторно — «уже отправлено»', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/expiring')
    await loaded()
    await user.click(within(main()).getByRole('button', { name: 'Напомнить всем' }))
    expect(await screen.findByText('Напоминания отправлены: 6 центров')).toBeInTheDocument()
    await waitFor(() => expect(rows().every(r => r.textContent?.includes('Напоминание отправлено'))).toBe(true))
    await user.click(within(main()).getByRole('button', { name: 'Напомнить всем' }))
    expect(await screen.findByText('Всем центрам в списке уже отправлено напоминание')).toBeInTheDocument()
  })

  it('счёт на продление: номер в строке, «Подтвердить оплату»; после оплаты центр уходит из списка', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/expiring')
    await loaded()
    await user.click(within(rowOf('Zebo Lingua')).getByRole('button', { name: 'Выставить счёт' }))
    expect(await screen.findByText(/^Счёт INV-\d+ выставлен: Zebo Lingua/)).toBeInTheDocument()
    await waitFor(() => expect(rowOf('Zebo Lingua')).toHaveTextContent(/Счёт INV-\d+/))
    await waitFor(() => expect(tile('Счета выставлены')).toContain('1 из 7'))

    await user.click(within(rowOf('Zebo Lingua')).getByRole('button', { name: 'Подтвердить оплату' }))
    const pay = await screen.findByRole('dialog', { name: 'Подтвердить поступление оплаты' })
    await within(pay).findByLabelText(/Сумма поступления, сомони/)
    await user.type(within(pay).getByLabelText(/№ платёжного поручения/), 'ПП № 88')
    await user.click(within(pay).getByRole('checkbox', { name: /деньги фактически поступили на расчётный счёт/ }))
    await user.click(within(pay).getByRole('button', { name: 'Подтвердить оплату' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(names()).not.toContain('Zebo Lingua'))
    expect(rows()).toHaveLength(6)
  })
})
