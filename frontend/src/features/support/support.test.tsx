/* Режим поддержки (PLT-CTR-050, NFR-SEC-030) и контекст кабинета центра (?center=&support=1). */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/mock/prototype-api'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

const main = () => screen.getByRole('main')
const rowOf = (name: string) => within(main()).getAllByRole('row').find(r => within(r).queryByText(name))!
const params = (router: ReturnType<typeof renderRoute>['router']) => new URLSearchParams(router.state.location.search)
const sidebar = () => screen.getByRole('complementary')
const banner = () => screen.queryByRole('region', { name: 'Режим поддержки' })

afterEach(() => vi.restoreAllMocks())

describe('вход в кабинет центра из реестра', () => {
  it('«Войти»: запись в журнале аудита, кабинет центра с баннером режима поддержки', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/centers')
    await within(main()).findByText('Alpha School')
    await user.click(within(rowOf('Alpha School')).getByRole('button', { name: 'Войти в кабинет центра Alpha School (режим поддержки)' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/center/profile'))
    expect(params(router).get('center')).toBe('3')
    expect(params(router).get('support')).toBe('1')
    await waitFor(() => expect(banner()).toHaveTextContent('Вы вошли в кабинет: Alpha School (действия записываются в журнал аудита)'))
    expect(sidebar()).toHaveTextContent('Alpha School')
    expect(sidebar()).toHaveTextContent('Тариф «Про»')
    expect(sidebar()).toHaveTextContent('Дилшод Азизов')

    const audit = await mock.audit.list({})
    expect(audit.items[0]).toMatchObject({ action: 'support.entered', entity: { id: 3, name: 'Alpha School' } })
  })

  it('без записи в журнале вход не выполняется', async () => {
    const user = userEvent.setup()
    vi.spyOn(api.support, 'enter').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { router } = renderRoute('/platform/centers')
    await within(main()).findByText('Дониш')
    await user.click(within(rowOf('Дониш')).getByRole('button', { name: /^Войти в кабинет центра Дониш/ }))
    expect(await screen.findByText(/Не удалось войти: вход в режим поддержки не записан в журнал аудита/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/platform/centers')
  })

  it('у заблокированного центра «Войти» нет', async () => {
    renderRoute('/platform/centers?filter=blocked')
    await within(main()).findByText('Школа будущего')
    expect(within(rowOf('Школа будущего')).queryByRole('button', { name: /Войти/ })).toBeNull()
    expect(within(rowOf('Школа будущего')).getByRole('button', { name: 'Действия: Школа будущего' })).toBeInTheDocument()
  })
})

describe('кабинет центра: центр и режим в адресе', () => {
  it('ссылки меню сохраняют центр и режим поддержки; «Выйти в кабинет платформы» ведёт в реестр', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/center/profile?center=4&support=1')
    await waitFor(() => expect(banner()).toHaveTextContent('Дониш'))
    const nav = screen.getByRole('navigation', { name: 'Основное меню' })
    expect(within(nav).getByRole('link', { name: 'Группы' })).toHaveAttribute('href', '/center/groups?center=4&support=1')

    await user.click(within(nav).getByRole('link', { name: 'Группы' }))
    expect(router.state.location.pathname).toBe('/center/groups')
    expect(banner()).toHaveTextContent('Дониш')

    await user.click(within(banner()!).getByRole('link', { name: /Выйти в кабинет платформы/ }))
    expect(router.state.location.pathname).toBe('/platform/centers')
  })

  it('без параметров: первый центр, адрес дополняется ?center=, баннера нет', async () => {
    const { router } = renderRoute('/center')
    await waitFor(() => expect(params(router).get('center')).toBe('1'))
    expect(router.state.location.pathname).toBe('/center/profile')
    expect(sidebar()).toHaveTextContent('Центр Перспектива')
    expect(banner()).toBeNull()
  })

  it('/center с параметрами ведёт на профиль, не теряя их', async () => {
    const { router } = renderRoute('/center?center=7&support=1')
    await waitFor(() => expect(router.state.location.pathname).toBe('/center/profile'))
    expect(params(router).get('center')).toBe('7')
    expect(params(router).get('support')).toBe('1')
  })

  it('переключатель центра меняет адрес и запоминается; несуществующий центр в адресе — последний выбранный', async () => {
    const user = userEvent.setup()
    const first = renderRoute('/center/profile')
    const select = await screen.findByRole('combobox', { name: 'Центр кабинета' })
    await waitFor(() => expect(select).toHaveValue('1'))
    await user.selectOptions(select, 'Дониш · Худжанд')
    expect(params(first.router).get('center')).toBe('4')
    await waitFor(() => expect(sidebar()).toHaveTextContent('Дониш'))
    expect(localStorage.getItem('eduhub.centerId')).toBe('4')
    first.unmount()

    const second = renderRoute('/center/profile') // без параметра — последний выбранный
    await waitFor(() => expect(params(second.router).get('center')).toBe('4'))
    second.unmount()

    const third = renderRoute('/center/profile?center=999')
    await waitFor(() => expect(params(third.router).get('center')).toBe('4'))
  })
})
