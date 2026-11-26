import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '@/test/render-route'

const mainNav = () => screen.getByRole('navigation', { name: 'Основное меню' })
const crumbs = () => screen.getByRole('navigation', { name: 'Навигационная цепочка' })
const navLabels = () => within(mainNav()).getAllByRole('link', { hidden: true }).map(a => a.textContent)
const activeLinks = () => within(mainNav()).queryAllByRole('link', { current: 'page' })
const groupButton = (name: string) => within(mainNav()).getByRole('button', { name })

describe('кабинет платформы', () => {
  it('«/» ведёт на главную платформы: активный пункт, крошки, заголовок вкладки', () => {
    const { router } = renderRoute('/')
    expect(router.state.location.pathname).toBe('/platform')
    expect(activeLinks().map(a => a.textContent)).toEqual(['Главная'])
    expect(crumbs()).toHaveTextContent('Платформа/Главная')
    expect(document.title).toBe('Главная · ЛИНИЯ')
  })

  it('неперенесённый экран показывает заглушку с файлом прототипа', () => {
    renderRoute('/platform/plans')
    expect(screen.getByText('Источник: src/js/views/platform/plans.js')).toBeInTheDocument()
  })

  it('меню: 14 пунктов в порядке прототипа, без сырых ключей перевода', () => {
    renderRoute('/platform')
    expect(navLabels()).toEqual([
      'Главная', 'Все центры', 'Подключить центр',
      'Модерация каталога', 'Истекают подписки', 'Риск оттока', 'Центры у лимита',
      'Тарифы и лимиты', 'B2B-биллинг и счета', 'Магазин методик', 'Биллинг SMS',
      'Рассылки (Broadcast)', 'Журнал аудита', 'Настройки платформы',
    ])
    expect(document.body.textContent).not.toMatch(/screens\.|layout\.|nav\.groups/)
  })

  it('«Подключить центр» подсвечивает только свой пункт, а не «Все центры» (адрес-префикс)', () => {
    renderRoute('/platform/centers/new')
    expect(activeLinks().map(a => a.textContent)).toEqual(['Подключить центр'])
  })

  it('дочерний экран: подсвечен родитель, в крошках ссылка на него', () => {
    renderRoute('/platform/centers/5/people')
    expect(activeLinks().map(a => a.textContent)).toEqual(['Все центры'])
    expect(within(crumbs()).getByRole('link', { name: 'Все центры' })).toHaveAttribute('href', '/platform/centers')
    expect(crumbs()).toHaveTextContent('Платформа/Все центры/Состав центра')
    expect(document.title).toBe('Состав центра · ЛИНИЯ')
  })

  it('экран из свёрнутой по умолчанию секции раскрывает её и запоминает', () => {
    renderRoute('/platform/billing')
    expect(groupButton('Монетизация')).toHaveAttribute('aria-expanded', 'true')
    expect(within(mainNav()).getByRole('link', { name: 'B2B-биллинг и счета' })).toBeVisible()
    expect(groupButton('Система')).toHaveAttribute('aria-expanded', 'false')
    expect(JSON.parse(localStorage.getItem('liniya.navOpen')!)).toMatchObject({ monetization: true })
  })

  it('секцию можно свернуть; выбор переживает перезагрузку', async () => {
    const user = userEvent.setup()
    const first = renderRoute('/platform')
    await user.click(groupButton('Требует внимания'))
    expect(groupButton('Требует внимания')).toHaveAttribute('aria-expanded', 'false')
    expect(within(mainNav()).queryByRole('link', { name: 'Риск оттока' })).toBeNull()
    first.unmount()

    renderRoute('/platform')
    expect(groupButton('Требует внимания')).toHaveAttribute('aria-expanded', 'false')
  })

  it('переход по меню меняет адрес, крошки и подсветку; секция активного экрана раскрывается', async () => {
    const user = userEvent.setup()
    localStorage.setItem('liniya.navOpen', JSON.stringify({ system: false }))
    const { router } = renderRoute('/platform')
    await user.click(within(mainNav()).getByRole('link', { name: 'Все центры' }))
    expect(router.state.location.pathname).toBe('/platform/centers')
    expect(crumbs()).toHaveTextContent('Платформа/Все центры')
    expect(activeLinks().map(a => a.textContent)).toEqual(['Все центры'])

    await router.navigate('/platform/audit')
    expect(await screen.findByText('Источник: src/js/views/platform/audit.js')).toBeInTheDocument()
    expect(groupButton('Система')).toHaveAttribute('aria-expanded', 'true')
  })

  it('испорченное значение в localStorage не ломает меню', () => {
    localStorage.setItem('liniya.navOpen', '{не json')
    renderRoute('/platform')
    expect(groupButton('Платформа')).toHaveAttribute('aria-expanded', 'true')
    expect(groupButton('Монетизация')).toHaveAttribute('aria-expanded', 'false')
  })

  it('ссылка «Кабинет центра» в шапке ведёт в кабинет центра', () => {
    renderRoute('/platform')
    expect(screen.getByRole('link', { name: 'Кабинет центра' })).toHaveAttribute('href', '/center')
  })
})

describe('кабинет центра', () => {
  it('«/center» открывает профиль центра; 12 пунктов меню в порядке прототипа', () => {
    const { router } = renderRoute('/center')
    expect(router.state.location.pathname).toBe('/center/profile')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Профиль центра')
    expect(activeLinks().map(a => a.textContent)).toEqual(['Профиль центра'])
    expect(navLabels()).toEqual([
      'Дашборд', 'Профиль центра', 'Пользователи', 'Сотрудники', 'Филиалы и каталог', 'Материалы и тесты',
      'Группы', 'Расписание', 'Поощрения', 'Автоправила coin', 'Аналитика', 'Баланс и счета',
    ])
  })

  it('карточка группы: подсвечены «Группы», заголовок «Группа»', () => {
    renderRoute('/center/groups/3')
    expect(activeLinks().map(a => a.textContent)).toEqual(['Группы'])
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Группа')
    expect(document.title).toBe('Группа · ЛИНИЯ')
  })

  it('ссылка «Админка платформы» ведёт в реестр центров', () => {
    renderRoute('/center/profile')
    expect(screen.getByRole('link', { name: 'Админка платформы' })).toHaveAttribute('href', '/platform/centers')
  })
})

describe('неизвестный адрес', () => {
  it('показывает страницу «не найдена» с адресом и ссылкой на главную', () => {
    renderRoute('/platform-old/xyz')
    expect(screen.getByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
    expect(screen.getByText('Адрес «/platform-old/xyz» не существует или устарел.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/')
    expect(document.title).toBe('Страница не найдена · ЛИНИЯ')
  })
})
