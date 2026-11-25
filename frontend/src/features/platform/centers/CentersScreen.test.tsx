import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, type CenterDto, type CentersList } from '@/api'
import { renderRoute } from '@/test/render-route'

// Intl ставит неразрывные пробелы в числах (2 400) — сравниваем с обычными
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const main = () => screen.getByRole('main')
const table = () => within(main()).getAllByRole('table')[0]
const rows = () => within(table()).getAllByRole('row').slice(1) // без шапки
const rowOf = (name: string) => rows().find(r => within(r).queryByText(name))!
const names = () => rows().map(r => norm(r.querySelector('td div')?.textContent))
const footer = () => within(main()).getByText(/^Показано|^Нет записей/)
const search = () => within(main()).getByRole('searchbox', { name: 'Поиск центров' })
const chip = (name: RegExp) => within(main()).getByRole('button', { name })
const loaded = () => within(main()).findByText('Центр Перспектива')

afterEach(() => vi.restoreAllMocks())

describe('реестр центров (PLT-CTR-010)', () => {
  it('открывается: плитки, 10 центров, «Показано 1–10 из 29 · всего на платформе: 142», чипы со счётчиками', async () => {
    renderRoute('/platform/centers')
    expect(within(main()).getByRole('heading', { level: 1 })).toHaveTextContent('Регистрация и управление учебными центрами')
    await loaded()
    expect(rows()).toHaveLength(10)
    expect(norm(footer().textContent)).toBe('Показано 1–10 из 29 · всего на платформе: 142')
    for (const [label, value] of [['Всего центров', '142'], ['Активные подписки', '118'], ['Новые за месяц', '+12'], ['В овердрафте', '4']]) {
      const tile = within(main()).getAllByText(label).find(el => el.closest('section')?.textContent?.includes(value))
      expect(tile, `${label}: ${value}`).toBeTruthy()
    }
    expect(chip(/^В овердрафте · 4$/)).toHaveAttribute('aria-pressed', 'false')
    expect(chip(/^Истекают · 7$/)).toBeInTheDocument()
    expect(chip(/^Риск оттока · 5$/)).toBeInTheDocument()
    expect(chip(/^Заблокированы · 1$/)).toBeInTheDocument()
    expect(chip(/^Все$/)).toHaveAttribute('aria-pressed', 'true')
    expect(within(main()).queryByRole('button', { name: 'Сбросить фильтры' })).toBeNull()
    expect(within(main()).getByRole('link', { name: 'Зарегистрировать центр' })).toHaveAttribute('href', '/platform/centers/new')
  })

  it('строки: владелец и вход, филиалы, сотрудники, SMS, баланс, овердрафт и статус', async () => {
    renderRoute('/platform/centers')
    await loaded()
    const umed = rowOf('Умед Плюс')
    expect(umed).toHaveTextContent('Душанбе · Фарида Рахимова')
    expect(umed).toHaveTextContent('Вход: 13 дней назад')
    expect(umed).toHaveTextContent('Филиалы 2/3')
    expect(umed).toHaveTextContent('9/10')
    expect(norm(umed.textContent)).toContain('310 шт')
    expect(norm(umed.textContent)).toContain('-150 сомонидоступно 150 сомони')
    expect(norm(umed.textContent)).toContain('использовано 150 сомони')
    expect(norm(umed.textContent)).toContain('из 300 сомони')
    expect(umed).toHaveTextContent('В овердрафте') // критерий 3: отрицательный баланс помечен
    expect(umed).toHaveTextContent('Риск оттокаПодписка: через 9 дней')

    const mathLab = rowOf('Math Lab')
    expect(mathLab).toHaveTextContent('Старт (бесплатно)')
    expect(mathLab).toHaveTextContent('нет пакета')
    expect(mathLab).toHaveTextContent('не предусмотрен')
    expect(mathLab).not.toHaveTextContent('Подписка:')

    const english = rowOf('English Hub')
    expect(english).toHaveTextContent('Овердрафт почти исчерпан')
    expect(norm(english.textContent)).toContain('использовано 420 сомони')

    expect(norm(rowOf('Центр Перспектива').textContent)).toContain('лимит 2 000 сомонине используется')
  })

  it('ссылка с главной (?q=) открывает реестр отфильтрованным; «Сбросить фильтры» возвращает всё', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/centers?q=%D0%94%D0%BE%D0%BD%D0%B8%D1%88')
    expect(await within(main()).findByText('Дониш')).toBeInTheDocument()
    expect(search()).toHaveValue('Дониш')
    expect(rows()).toHaveLength(1)
    expect(norm(footer().textContent)).toBe('Показано 1–1 из 1 · всего на платформе: 142')

    await user.click(within(main()).getByRole('button', { name: 'Сбросить фильтры' }))
    await waitFor(() => expect(rows()).toHaveLength(10))
    expect(search()).toHaveValue('')
    expect(router.state.location.search).toBe('')
  })

  it('поиск с задержкой: адрес и выдача обновляются после ввода', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/centers')
    await loaded()
    await user.type(search(), 'худжанд')
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get('q')).toBe('худжанд'))
    await waitFor(() => expect(rows()).toHaveLength(6))
    rows().forEach(r => expect(r).toHaveTextContent('Худжанд ·'))
  })

  it('чип «В овердрафте» оставляет центры с отрицательным балансом (критерий 3)', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/centers')
    await loaded()
    await user.click(chip(/^В овердрафте · 4$/))
    await waitFor(() => expect(names()).toEqual(['Умед Плюс', 'English Hub', 'Pamir Coding', 'Школа будущего']))
    expect(chip(/^В овердрафте · 4$/)).toHaveAttribute('aria-pressed', 'true')
    expect(new URLSearchParams(router.state.location.search).get('filter')).toBe('overdraft')
  })

  it('фильтры «Тариф» и «Город» из справочников', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/centers')
    await loaded()
    const plan = within(main()).getByRole('combobox', { name: 'Тариф' })
    expect(within(plan).getAllByRole('option').map(o => o.textContent)).toEqual(['Все тарифы', 'Старт', 'Базовый', 'Про', 'Бизнес'])
    await user.selectOptions(plan, 'Про')
    await waitFor(() => expect(rows().every(r => within(r).queryByText('Про'))).toBe(true))
    expect(norm(footer().textContent)).toBe('Показано 1–8 из 8 · всего на платформе: 142')

    await user.selectOptions(plan, 'all')
    await user.selectOptions(within(main()).getByRole('combobox', { name: 'Город' }), 'Хорог')
    await waitFor(() => expect(names()).toEqual(['Pamir Coding', 'Ситораи Шарқ']))
  })

  it('страницы: переход меняет адрес; смена фильтра возвращает на первую (критерий 2)', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/centers')
    await loaded()
    await user.click(within(main()).getByRole('button', { name: 'Страница 2' }))
    await waitFor(() => expect(norm(footer().textContent)).toBe('Показано 11–20 из 29 · всего на платформе: 142'))
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('2')
    expect(within(main()).getByRole('button', { name: 'Страница 2' })).toHaveAttribute('aria-current', 'page')
    expect(rowOf('Бахор')).toHaveTextContent('Подписка: просрочено 2 дня')

    await user.click(chip(/^Истекают · 7$/))
    await waitFor(() => expect(norm(footer().textContent)).toBe('Показано 1–7 из 7 · всего на платформе: 142'))
    expect(new URLSearchParams(router.state.location.search).get('page')).toBeNull()
    expect(within(main()).queryByRole('navigation', { name: 'Страницы' })).toBeNull() // одна страница — без кнопок
  })

  it('несуществующая страница в адресе исправляется на последнюю', async () => {
    const { router } = renderRoute('/platform/centers?page=9')
    await waitFor(() => expect(rows()).toHaveLength(9))
    expect(within(main()).queryByText('Ничего не найдено. Измените фильтры или поиск.')).toBeNull()
    expect(norm(footer().textContent)).toBe('Показано 21–29 из 29 · всего на платформе: 142')
    expect(new URLSearchParams(router.state.location.search).get('page')).toBe('3')
  })

  it('неизвестный фильтр в адресе — как «Все»', async () => {
    renderRoute('/platform/centers?filter=foo')
    await loaded()
    expect(rows()).toHaveLength(10)
    expect(chip(/^Все$/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('пусто: сообщение и «Сбросить фильтры» в таблице', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/centers?q=zzz')
    expect(await within(main()).findByText('Ничего не найдено. Измените фильтры или поиск.')).toBeInTheDocument()
    expect(norm(footer().textContent)).toBe('Нет записей · всего на платформе: 142')
    const resetButtons = within(main()).getAllByRole('button', { name: 'Сбросить фильтры' })
    await user.click(resetButtons[resetButtons.length - 1]) // кнопка в пустой таблице
    await waitFor(() => expect(rows()).toHaveLength(10))
  })

  it('ошибка загрузки: сообщение и «Повторить»', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.centers, 'list').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderRoute('/platform/centers')
    const alert = await within(main()).findByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить данные')
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }))
    await loaded()
  })

  it('открытый счёт на смену тарифа виден в строке', async () => {
    const real = await api.centers.list({ page: 1, pageSize: 10 })
    const withChange = (c: CenterDto, pc: Partial<NonNullable<CenterDto['pendingChange']>>): CenterDto => ({
      ...c,
      pendingChange: { invoiceId: 'INV-1', planId: 'pro', planName: 'Про', amount: 900, deferred: false, dueAt: null, overdue: false, ...pc },
    })
    const items = real.items.map((c, i) =>
      i === 0 ? withChange(c, {}) : i === 1 ? withChange(c, { deferred: true, overdue: true, dueAt: '2026-01-01T00:00:00Z' }) : c,
    )
    vi.spyOn(api.centers, 'list').mockResolvedValue({ ...real, items } satisfies CentersList)
    renderRoute('/platform/centers')
    await loaded()
    expect(rowOf('Центр Перспектива')).toHaveTextContent('→ Про · ждёт оплаты')
    expect(rowOf('Indigo Academy')).toHaveTextContent('оплата тарифа просрочена')
  })
})
