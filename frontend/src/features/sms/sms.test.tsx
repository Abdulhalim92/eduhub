/* «Начислить пакет SMS» из реестра (PLT-SMS-020). mock общий для файла: у каждого теста свой центр. */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const main = () => screen.getByRole('main')
const rowOf = (name: string) => within(main()).getAllByRole('row').find(r => within(r).queryByText(name))!
type User = ReturnType<typeof userEvent.setup>

async function openSms(center: string, path = '/platform/centers') {
  const user = userEvent.setup()
  renderRoute(path)
  await within(main()).findByText(center)
  await user.click(within(rowOf(center)).getByRole('button', { name: `Действия: ${center}` }))
  await user.click(await screen.findByRole('menuitem', { name: /Начислить пакет SMS/ }))
  const d = await screen.findByRole('dialog', { name: 'Начислить пакет SMS' })
  await within(d).findByRole('radiogroup', { name: 'Пакет' })
  return { user, d }
}
const radio = (d: HTMLElement, name: RegExp) => within(d).getByRole('radio', { name })
const submit = (user: User, d: HTMLElement) => user.click(within(d).getByRole('button', { name: /^Начислить/ }))

describe('начисление пакета SMS', () => {
  it('пункт меню с SMS-балансом; у заблокированного центра пункта нет', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/centers')
    await within(main()).findByText('Центр Перспектива')
    await user.click(within(rowOf('Центр Перспектива')).getByRole('button', { name: 'Действия: Центр Перспектива' }))
    expect(norm((await screen.findByRole('menuitem', { name: /Начислить пакет SMS/ })).textContent)).toBe('Начислить пакет SMS…SMS-баланс 820 шт')
  })

  it('по умолчанию 1 000 SMS с баланса на платформе; после начисления растут SMS-баланс и списание с баланса (критерий 3)', async () => {
    const { user, d } = await openSms('Центр Перспектива')
    expect(radio(d, /^1\s000 SMS/)).toHaveAttribute('aria-checked', 'true')
    expect(radio(d, /^Списать с баланса на платформе/)).toHaveAttribute('aria-checked', 'true')
    expect(norm(d.textContent)).toContain('Баланс 2 400 сомони · доступно 4 400 сомони. После списания: 2 190 сомони.')
    await submit(user, d)

    expect(await screen.findByText(/Начислено 1\s000 SMS · Центр Перспектива/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(norm(rowOf('Центр Перспектива').textContent)).toContain('1 820 шт'))
    expect(norm(rowOf('Центр Перспектива').textContent)).toContain('2 190 сомонидоступно 4 190 сомони')
    const audit = await mock.audit.list({})
    expect(audit.items[0]).toMatchObject({ action: 'sms.accrued', entity: { name: 'Центр Перспектива' } })
  })

  it('не хватает баланса — «с баланса» недоступно с пояснением, выбран другой способ (критерий 1)', async () => {
    const { d } = await openSms('Math Lab')
    expect(radio(d, /^Списать с баланса на платформе/)).toBeDisabled()
    expect(norm(d.textContent)).toContain('Не хватает: доступно 0 сомони, нужно 210 сомони.')
    expect(radio(d, /^Деньги получены вне системы/)).toHaveAttribute('aria-checked', 'true')
  })

  it('пакет дороже доступного переключает способ на «вне системы»', async () => {
    const { user, d } = await openSms('Рушд') // доступно 300
    expect(radio(d, /^Списать с баланса на платформе/)).toHaveAttribute('aria-checked', 'true')
    await user.click(radio(d, /^5\s000 SMS/))
    expect(radio(d, /^Списать с баланса на платформе/)).toBeDisabled()
    expect(radio(d, /^Деньги получены вне системы/)).toHaveAttribute('aria-checked', 'true')
  })

  it('бесплатно без причины — отказ под полем; с причиной — начислено (критерий 2)', async () => {
    const { user, d } = await openSms('Дониш')
    await user.click(radio(d, /^Начислить бесплатно/))
    await submit(user, d)
    expect(await within(d).findByText('Минимум 5 символов')).toBeInTheDocument()
    expect(within(d).getByLabelText(/Причина бесплатного начисления/)).toHaveFocus()
    await user.type(within(d).getByLabelText(/Причина бесплатного начисления/), 'Компенсация за сбой шлюза')
    await submit(user, d)
    expect(await screen.findByText(/Начислено 1\s000 SMS · Дониш/)).toBeInTheDocument()
    const audit = await mock.audit.list({})
    expect(audit.items[0]).toMatchObject({ action: 'sms.accrued', after: { status: 'bonus' } })
  })

  it('деньги вне системы: без документа и подтверждения — ошибки под полями', async () => {
    const { user, d } = await openSms('Sitora Kids')
    await user.click(radio(d, /^Деньги получены вне системы/))
    expect(radio(d, /Безнал/)).toHaveAttribute('aria-checked', 'true')
    await submit(user, d)
    expect(await within(d).findByText('Укажите № платёжного поручения')).toBeInTheDocument()
    expect(within(d).getByText('Подтвердите, что деньги действительно поступили')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Начислить пакет SMS' })).toBeInTheDocument()
  })

  it('у заблокированного центра пункта «Начислить пакет SMS» нет', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/centers?filter=blocked')
    await within(main()).findByText('Школа будущего')
    await user.click(within(rowOf('Школа будущего')).getByRole('button', { name: 'Действия: Школа будущего' }))
    await screen.findAllByRole('menuitem')
    expect(screen.queryByRole('menuitem', { name: /Начислить пакет SMS/ })).toBeNull()
  })
})
