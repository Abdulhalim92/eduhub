/* Адаптивная разметка: телефон и планшет — карточки вместо таблиц и меню-шторка; ноутбук от 1280 px — таблица реестра. */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '@/test/render-route'
import { setViewportWidth } from '@/test/viewport'

const main = () => screen.getByRole('main')

describe('реестр центров по ширине экрана', () => {
  it('телефон (375): карточки с данными и действиями вместо таблицы', async () => {
    setViewportWidth(375)
    renderRoute('/platform/centers')
    const card = await within(main()).findByRole('article', { name: 'Умед Плюс' })
    expect(within(main()).queryByRole('table')).toBeNull()
    expect(within(main()).getAllByRole('article')).toHaveLength(10)
    // те же данные, что в строке таблицы, с подписями
    const facts = within(card).getAllByRole('term').map(dt => dt.textContent)
    expect(facts).toEqual(['Тариф', 'Сотрудники / лимит', 'SMS-баланс', 'Баланс на платформе', 'Овердрафт'])
    expect(card).toHaveTextContent('В овердрафте')
    expect(card).toHaveTextContent('Подписка: через 9 дней')
    expect(within(card).getByRole('button', { name: /Войти в кабинет центра Умед Плюс/ })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Действия: Умед Плюс' })).toBeInTheDocument()
    expect(within(main()).getByText(/Показано 1–10 из 29/)).toBeInTheDocument()
  })

  it('ноутбук 1024 (с постоянным сайдбаром) — ещё карточки; от 1280 — таблица', async () => {
    setViewportWidth(1024)
    const first = renderRoute('/platform/centers')
    await within(main()).findByRole('article', { name: 'Центр Перспектива' })
    first.unmount()

    setViewportWidth(1280)
    renderRoute('/platform/centers')
    await within(main()).findByText('Центр Перспектива')
    expect(within(main()).getByRole('table')).toBeInTheDocument()
    expect(within(main()).queryByRole('article')).toBeNull()
  })

  it('пусто на телефоне: сообщение и «Сбросить фильтры»', async () => {
    setViewportWidth(375)
    renderRoute('/platform/centers?q=zzz')
    expect(await within(main()).findByText('Ничего не найдено. Измените фильтры или поиск.')).toBeInTheDocument()
  })
})

describe('главная на телефоне', () => {
  it('«Активность центров» — карточки; карточка ведёт в реестр с фильтром', async () => {
    setViewportWidth(375)
    const user = userEvent.setup()
    const { router } = renderRoute('/platform')
    const region = screen.getByRole('region', { name: 'Активность центров' })
    const card = await within(region).findByRole('article', { name: 'Alpha School' })
    expect(within(region).queryByRole('table')).toBeNull()
    expect(card).toHaveTextContent('Душанбе · Про')
    expect(card).toHaveTextContent('11 дней назад · 0 уроков')
    expect(card).toHaveTextContent('Риск оттока')
    await user.click(within(card).getByText(/11 дней назад/))
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('Alpha School')
  })
})

describe('меню на узком экране', () => {
  it('кнопка меню открывает шторку с разделами; переход по пункту закрывает её', async () => {
    setViewportWidth(375)
    const user = userEvent.setup()
    const { router } = renderRoute('/platform')
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }))
    const drawer = await screen.findByRole('dialog', { name: 'Основное меню' })
    await user.click(within(drawer).getByRole('link', { name: 'Все центры' }))
    expect(router.state.location.pathname).toBe('/platform/centers')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Основное меню' })).toBeNull())
  })

  it('в кабинете центра шторка сохраняет центр и режим поддержки в ссылках', async () => {
    setViewportWidth(375)
    const user = userEvent.setup()
    renderRoute('/center/profile?center=4&support=1')
    await screen.findByRole('region', { name: 'Режим поддержки' })
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }))
    const drawer = await screen.findByRole('dialog', { name: 'Основное меню' })
    expect(within(drawer).getByRole('link', { name: 'Группы' })).toHaveAttribute('href', '/center/groups?center=4&support=1')
  })
})
