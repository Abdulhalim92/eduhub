import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/mock/prototype-api'
import { ApiError } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

// Intl ставит неразрывные пробелы в числах (48 500) — сравниваем с обычными
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const byText = (text: string) => (_: string, el: Element | null) =>
  !!el && norm(el.textContent) === text && [...el.children].every(ch => norm(ch.textContent) !== text)

const attention = () => screen.getByRole('region', { name: 'Требует внимания' })
const activity = () => screen.getByRole('region', { name: 'Активность центров' })
const rows = () => within(activity()).getAllByRole('row').slice(1) // без строки шапки
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map(td => norm(td.textContent))

afterEach(() => vi.restoreAllMocks())

describe('главная платформы', () => {
  it('заголовок, главная кнопка и демо-плитки KPI', () => {
    renderRoute('/platform')
    expect(screen.getByRole('heading', { level: 1, name: 'Главная' })).toBeInTheDocument()
    // в сайдбаре есть пункт с тем же названием — ищем главную кнопку внутри экрана
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Подключить центр' })).toHaveAttribute('href', '/platform/centers/new')
    for (const text of ['142', '+12 за месяц', '118', '83% конверсия', '48 500 сомони', '+18,4% к прошл. месяцу', '64 200 шт', 'остаток в пакетах 120 000'])
      expect(screen.getByText(byText(text))).toBeInTheDocument()
  })

  it('«Требует внимания»: счётчики очередей из api с падежами, общая сумма, ссылки на очереди', async () => {
    renderRoute('/platform')
    const w = attention()
    expect(await within(w).findByText('4 новых филиала ожидают проверки')).toBeInTheDocument()
    expect(within(w).getByText('7 центров требуют продления')).toBeInTheDocument()
    expect(within(w).getByText('5 центров не заходили >10 дней')).toBeInTheDocument()
    expect(within(w).getByText('6 центров подошли к лимиту тарифа')).toBeInTheDocument()
    expect(within(w).getByLabelText('Всего: 22')).toHaveTextContent('22')
    expect(within(w).getAllByRole('link').map(a => a.getAttribute('href'))).toEqual([
      '/platform/moderation', '/platform/expiring', '/platform/churn', '/platform/limits',
    ])
  })

  it('«Активность центров»: пять центров с тарифом, входом, уроками и статусом', async () => {
    renderRoute('/platform')
    expect(within(activity()).getAllByTestId('skeleton-row')).toHaveLength(5)
    await within(activity()).findByText('Центр Перспектива')
    expect(rows()).toHaveLength(5)
    expect(cells(rows()[0]).slice(0, 5)).toEqual(['Центр ПерспективаДушанбе', 'Бизнес', 'Сегодня', '84 урока', 'Активен'])
    expect(cells(rows()[2]).slice(0, 5)).toEqual(['Alpha SchoolДушанбе', 'Про', '11 дней назад', '0 уроков', 'Риск оттока'])
    expect(cells(rows()[4]).slice(0, 5)).toEqual(['Умед ПлюсДушанбе', 'Базовый', '13 дней назад', '3 урока', 'Риск оттока'])
  })

  it('клик по строке открывает реестр, отфильтрованный по центру (PLT-DSH-010, критерий 2)', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform')
    await within(activity()).findByText('Indigo Academy')
    await user.click(within(rows()[1]).getByText('Бизнес')) // клик по ячейке тарифа, не по ссылке
    expect(router.state.location.pathname).toBe('/platform/centers')
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('Indigo Academy')
  })

  it('название центра — ссылка на реестр с фильтром (для клавиатуры)', async () => {
    renderRoute('/platform')
    const link = await within(activity()).findByRole('link', { name: 'Дониш' })
    expect(link).toHaveAttribute('href', '/platform/centers?q=%D0%94%D0%BE%D0%BD%D0%B8%D1%88')
  })

  it('меню строки: «Открыть в реестре центров» ведёт в реестр с фильтром', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform')
    await user.click(await within(activity()).findByRole('button', { name: 'Действия: Alpha School' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map(i => norm(i.textContent))).toEqual([
      'Открыть в реестре центровВсе действия по центру',
      'Войти в кабинетРежим поддержки: вход записывается в журнал аудита',
      'Баланс и овердрафт…Баланс на платформе 120 сомони',
    ])
    await user.click(items[0])
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('Alpha School')
  })

  it('меню строки: «Баланс и овердрафт…» открывает финансы центра', async () => {
    const user = userEvent.setup()
    renderRoute('/platform')
    await user.click(await within(activity()).findByRole('button', { name: 'Действия: Дониш' }))
    await user.click(await screen.findByRole('menuitem', { name: /Баланс и овердрафт/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Финансы центра' })
    await within(sheet).findByRole('region', { name: 'Баланс на платформе' })
    expect(sheet).toHaveAccessibleDescription('Дониш')
  })

  it('ошибка загрузки очередей: сообщение и «Повторить», после повтора — данные', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.platform, 'attention').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderRoute('/platform')
    const alert = await within(attention()).findByRole('alert')
    expect(alert).toHaveTextContent('Не удалось загрузить данные. Проверьте соединение и повторите.')
    await user.click(within(alert).getByRole('button', { name: 'Повторить' }))
    expect(await within(attention()).findByText('7 центров требуют продления')).toBeInTheDocument()
  })

  it('ошибка api в таблице показывает сообщение сервера', async () => {
    vi.spyOn(api.centers, 'recentActivity').mockRejectedValueOnce(new ApiError('FORBIDDEN', 'Нет доступа к списку центров', {}))
    renderRoute('/platform')
    expect(await within(activity()).findByRole('alert')).toHaveTextContent('Нет доступа к списку центров')
  })

  it('график: легенда «Факт / Прогноз» и таблица значений для экранных чтецов', () => {
    renderRoute('/platform')
    expect(screen.getByText('Факт')).toBeInTheDocument()
    expect(screen.getByText('Прогноз')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Подключения по месяцам' })
    const body = within(table).getAllByRole('row').slice(1)
    expect(body).toHaveLength(11)
    expect(cells(body[6])).toEqual(['Июл', '6 100'])
    expect(cells(body[10])).toEqual(['Ноя (прогноз)', '3 200'])
  })
})

describe('падежи после чисел (ru)', () => {
  const t = i18n.t.bind(i18n)
  it.each([
    [1, '1 новый филиал ожидает проверки'],
    [2, '2 новых филиала ожидают проверки'],
    [5, '5 новых филиалов ожидают проверки'],
    [11, '11 новых филиалов ожидают проверки'],
    [21, '21 новый филиал ожидает проверки'],
    [24, '24 новых филиала ожидают проверки'],
  ])('модерация: %i', (count, text) => {
    expect(t('home.attention.moderation.text', { count })).toBe(text)
  })

  it.each([
    [0, '0 уроков'],
    [1, '1 урок'],
    [3, '3 урока'],
    [12, '12 уроков'],
    [84, '84 урока'],
  ])('уроки: %i', (count, text) => {
    expect(t('center.lessons', { count })).toBe(text)
  })

  it('дни с последнего входа', () => {
    expect(t('center.login.daysAgo', { count: 2 })).toBe('2 дня назад')
    expect(t('center.login.daysAgo', { count: 11 })).toBe('11 дней назад')
    expect(t('center.login.daysAgo', { count: 21 })).toBe('21 день назад')
  })
})
