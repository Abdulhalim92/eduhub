/* «Настройка модулей» (PLT-CTR-040, только просмотр — Q-024) и «Данные для входа администратора» (SYS-ACC-020, BR-025). */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

const main = () => screen.getByRole('main', { hidden: true })
const rowOf = (name: string) => within(main()).getAllByRole('row', { hidden: true }).find(r => within(r).queryByText(name))!

async function openModules(center: string, path = '/platform/centers') {
  const user = userEvent.setup()
  const r = renderRoute(path)
  await within(main()).findByText(center)
  await user.click(within(rowOf(center)).getByRole('button', { name: `Действия: ${center}` }))
  await user.click(await screen.findByRole('menuitem', { name: /Настройка модулей/ }))
  const sheet = await screen.findByRole('dialog', { name: 'Настройка модулей' })
  expect(sheet).toHaveAccessibleDescription(center)
  return { user, sheet, router: r.router }
}

describe('настройка модулей — просмотр', () => {
  it('модули и лимиты тарифа без переключателей; тариф и сотрудники', async () => {
    const { sheet } = await openModules('Math Lab') // «Старт»: только гео-чек-ин
    const items = within(within(sheet).getByRole('list')).getAllByRole('listitem').map(li => li.textContent)
    expect(items).toEqual(['Расчёт зарплатВыключен', 'Учёт инвентаряВыключен', 'CRM-воронкаВыключен', 'Гео-чек-инВключён'])
    expect(sheet).toHaveTextContent('1 из 4 включено')
    expect(within(sheet).getByRole('region', { name: 'Тариф центра' })).toHaveTextContent('Старт · бесплатно')
    expect(within(sheet).getByRole('region', { name: 'Тариф центра' })).toHaveTextContent('Сотрудники 4 из 5')
    expect(sheet).toHaveTextContent('Модули и лимиты определяются тарифом центра. Чтобы изменить их, смените тариф.')
    // демонстрационных переключателей и ползунков прототипа нет
    expect(within(sheet).queryByRole('switch')).toBeNull()
    expect(within(sheet).queryByRole('slider')).toBeNull()
    expect(within(sheet).queryByRole('button', { name: 'Сохранить' })).toBeNull()
  })

  it('у заблокированного центра — только просмотр, без действий', async () => {
    const { sheet } = await openModules('Школа будущего', '/platform/centers?filter=blocked')
    expect(within(sheet).queryByRole('button', { name: /Войти как администратор/ })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: /Данные для входа/ })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: 'Сменить тариф' })).toBeNull()
    expect(within(sheet).getByRole('list')).toBeInTheDocument()
  })

  it('«Сменить тариф» открывает смену тарифа вместо панели', async () => {
    const { user, sheet } = await openModules('Alpha School')
    await user.click(within(sheet).getByRole('button', { name: 'Сменить тариф' }))
    expect(await screen.findByRole('dialog', { name: 'Смена тарифа · Alpha School' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Настройка модулей' })).toBeNull())
  })

  it('«Войти как администратор центра» — режим поддержки', async () => {
    const { user, sheet, router } = await openModules('Indigo Academy')
    await user.click(within(sheet).getByRole('button', { name: /Войти как администратор центра/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/center/profile'))
    expect(new URLSearchParams(router.state.location.search).get('support')).toBe('1')
  })
})

describe('данные для входа администратора (SYS-ACC-020)', () => {
  it('без основания — отказ; с основанием — логин-телефон и пароль один раз, Esc не закрывает, в журнале без пароля', async () => {
    const { user, sheet } = await openModules('Sitora Kids')
    await user.click(within(sheet).getByRole('button', { name: 'Данные для входа администратора центра' }))
    const d = await screen.findByRole('dialog', { name: 'Данные для входа администратора' })
    await user.type(within(d).getByLabelText(/Основание/), 'abc')
    await user.click(within(d).getByRole('button', { name: 'Создать пароль' }))
    expect(await within(d).findByText('Минимум 5 символов')).toBeInTheDocument()

    await user.type(within(d).getByLabelText(/Основание/), ' — владелец потерял пароль')
    await user.click(within(d).getByRole('button', { name: 'Создать пароль' }))
    const shown = await screen.findByRole('dialog', { name: 'Данные для входа' })
    expect(shown).toHaveAccessibleDescription('Ситора Назарова · Sitora Kids')
    const values = within(shown).getAllByRole('definition').map(dd => dd.textContent).filter(v => v && v !== 'Копировать')
    const [login, password] = values as string[]
    expect(login).toBe('992901001007') // номер телефона владельца
    expect(password).toMatch(/^\S{10}$/)

    await user.click(within(shown).getByRole('button', { name: 'Копировать пароль' }))
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(password)

    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Данные для входа' })).toBeInTheDocument()

    const audit = await mock.audit.list({})
    const entry = audit.items[0]
    expect(entry).toMatchObject({ action: 'center.credentials', entity: { name: 'Sitora Kids' }, after: { login } })
    expect(JSON.stringify(entry)).not.toContain(password)

    await user.click(within(shown).getByRole('button', { name: 'Готово, я передал данные' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Данные для входа' })).toBeNull())
  })
})
