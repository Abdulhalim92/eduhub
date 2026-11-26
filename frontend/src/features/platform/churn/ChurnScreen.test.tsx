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
const chip = (name: RegExp) => within(main()).getByRole('button', { name })
const loaded = () => within(main()).findByText('Рушд')

// Порядок тестов значим: назначения менеджеров и контакты из ранних тестов видны в поздних.
describe('риск оттока (PLT-DSH-020)', () => {
  it('5 центров по убыванию риска, плитки, причины и счётчики чипов', async () => {
    renderRoute('/platform/churn')
    expect(within(main()).getByRole('heading', { level: 1 })).toHaveTextContent('Риск оттока (Churn Risk)')
    await loaded()
    expect(names()).toEqual(['Рушд', 'Умед Плюс', 'Alpha School', 'Pamir Coding', 'English Hub'])
    expect(tile('Центров в зоне риска')).toContain('5')
    expect(tile('Высокий риск')).toContain('1')
    expect(tile('Выручка под угрозой')).toContain('3 000 сомони')
    expect(tile('Без менеджера')).toContain('4')
    expect(rowOf('Рушд')).toHaveTextContent('Высокий')
    expect(rowOf('Рушд')).toHaveTextContent('99/100')
    expect(rowOf('Рушд')).toHaveTextContent(/\d+ (день|дня|дней) без входа/)
    expect(within(rowOf('Alpha School')).getByRole('combobox', { name: 'Менеджер центра Alpha School' })).toHaveValue('Нигора Р.')
    expect(chip(/^Все · 5$/)).toHaveAttribute('aria-pressed', 'true')
    expect(chip(/^Без менеджера · 4$/)).toBeInTheDocument()
    expect(chip(/^Связались · 0$/)).toBeInTheDocument()
  })

  it('уровень риска «Высокий» — только Рушд, в адресе ?risk=high', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/churn')
    await loaded()
    await user.selectOptions(within(main()).getByRole('combobox', { name: 'Уровень риска' }), 'high')
    await waitFor(() => expect(names()).toEqual(['Рушд']))
    expect(router.state.location.search).toBe('?risk=high')
  })

  it('назначенный менеджер убирает центр из «Без менеджера»', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/churn?filter=nomanager')
    await loaded()
    expect(names()).toHaveLength(4)
    await user.selectOptions(within(rowOf('Умед Плюс')).getByRole('combobox', { name: 'Менеджер центра Умед Плюс' }), 'Нигора Р.')
    expect(await screen.findByText('Менеджер Нигора Р. назначен: Умед Плюс')).toBeInTheDocument()
    await waitFor(() => expect(names()).not.toContain('Умед Плюс'))
    expect(chip(/^Без менеджера · 3$/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('«Связались»: метка «Контакт сегодня», кнопка недоступна, центр в «Связались»', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/churn')
    await loaded()
    await user.click(within(rowOf('Pamir Coding')).getByRole('button', { name: 'Связались' }))
    expect(await screen.findByText('Контакт с центром «Pamir Coding» зафиксирован')).toBeInTheDocument()
    await waitFor(() => expect(rowOf('Pamir Coding')).toHaveTextContent('Контакт сегодня'))
    expect(within(rowOf('Pamir Coding')).getByRole('button', { name: 'Контакт есть' })).toBeDisabled()
    // у центра с контактом всегда есть ответственный (правило api)
    expect(within(rowOf('Pamir Coding')).getByRole('combobox', { name: /Менеджер центра/ })).not.toHaveValue('')
    await user.click(chip(/^Связались · 1$/))
    await waitFor(() => expect(names()).toEqual(['Pamir Coding']))
  })

  it('меню строки: войти в кабинет, модули, баланс, тариф', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/churn')
    await loaded()
    await user.click(within(rowOf('English Hub')).getByRole('button', { name: 'Действия: English Hub' }))
    const items = (await screen.findAllByRole('menuitem')).map(i => norm(i.textContent))
    expect(items).toHaveLength(4)
    expect(items[0]).toMatch(/^Войти в кабинет/)
    expect(items[1]).toMatch(/^Настройка модулей/)
    expect(items[2]).toMatch(/^Баланс и овердрафт/)
    expect(items[3]).toMatch(/^Сменить тариф/)
  })
})
