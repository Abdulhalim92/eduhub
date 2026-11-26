/* «Сменить тариф» из реестра (PLT-TRF-020/030, BR-001, BR-007, BR-008) и действия с открытым счётом (PLT-BIL-040, BR-004).
   mock общий для файла: у каждого теста свой центр. */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
// hidden: пока открыт диалог, Radix скрывает остальную страницу от экранных чтецов (aria-hidden) — реестр ищем и там
const main = () => screen.getByRole('main', { hidden: true })
const rowOf = (name: string) => within(main()).getAllByRole('row', { hidden: true }).find(r => within(r).queryByText(name))!
const radio = (d: HTMLElement, name: RegExp) => within(d).getByRole('radio', { name })
type User = ReturnType<typeof userEvent.setup>

async function openPlanChange(center: string) {
  const user = userEvent.setup()
  renderRoute('/platform/centers')
  await within(main()).findByText(center)
  await user.click(within(rowOf(center)).getByRole('button', { name: `Действия: ${center}` }))
  await user.click(await screen.findByRole('menuitem', { name: /Сменить тариф/ }))
  const d = await screen.findByRole('dialog', { name: `Смена тарифа · ${center}` })
  await within(d).findByRole('region', { name: 'Сейчас' })
  return { user, d }
}
async function issueInvoice(user: User, d: HTMLElement, plan: RegExp, reason = 'Центр растёт') {
  await user.click(radio(d, plan))
  await user.type(within(d).getByLabelText(/Причина смены/), reason)
  await user.click(within(d).getByRole('button', { name: /^Выставить счёт на/ }))
  return within(d).findByRole('region', { name: /^Счёт INV-\d+ ожидает оплаты$/ })
}

describe('смена тарифа: выбор', () => {
  it('подходящие тарифы с разницей в цене и будущей занятостью; неподходящие — свёрнуты с причиной (BR-008)', async () => {
    const { d } = await openPlanChange('Умед Плюс')
    expect(within(d).getByRole('region', { name: 'Сейчас' })).toHaveTextContent('Тариф «Базовый» · 400 сомони/мес')
    // выбрать можно только то, во что центр помещается
    const planRadios = within(within(d).getByRole('radiogroup', { name: 'Новый тариф' })).getAllByRole('radio')
    expect(planRadios.map(r => /^(Старт|Базовый|Про|Бизнес)/.exec(r.textContent ?? '')?.[1])).toEqual(['Про', 'Бизнес'])
    const pro = radio(d, /^Про/)
    expect(pro).toHaveAttribute('aria-checked', 'true')
    expect(pro).toHaveTextContent('Рекомендуем')
    expect(norm(pro.textContent)).toContain('дороже текущего на 500 сомони')
    expect(norm(pro.textContent)).toContain('на балансе не хватает — оплата по счёту')
    expect(norm(pro.textContent)).toContain('После перехода будет занято:сотрудники 9 из 50хранилище 7 из 50 ГБфилиалы 2 из 10')
    // «Старт» не вмещает — в свёрнутом блоке с причиной словами
    expect(within(d).queryByRole('radio', { name: /^Старт/ })).toBeNull()
    const unfit = within(d).getByText(/Не подходят по лимитам: Старт/).closest('details')!
    expect(norm(unfit.textContent)).toContain('сотрудников 9, а лимит 5; хранилище 7 ГБ, а лимит 2 ГБ')
    // «с баланса» недоступно: доступно 150 при цене 900
    expect(radio(d, /^Списать с баланса на платформе/)).toBeDisabled()
    expect(norm(d.textContent)).toContain('Не хватает: доступно 150 сомони (баланс + овердрафт), нужно 900 сомони.')
    expect(norm(d.textContent)).toContain('Будет выставлен счёт на 900 сомони за 1 месяц нового тарифа. Тариф сменится после оплаты.')
    expect(within(d).getByRole('button', { name: 'Выставить счёт на 900 сомони' })).toBeEnabled()
  })

  it('без причины — отказ под полем (BR-011)', async () => {
    const { user, d } = await openPlanChange('Умед Плюс')
    await user.click(within(d).getByRole('button', { name: 'Выставить счёт на 900 сомони' }))
    expect(await within(d).findByText('Укажите причину (минимум 5 символов)')).toBeInTheDocument()
    expect(within(d).getByLabelText(/Причина смены/)).toHaveFocus()
  })
})

describe('смена тарифа через счёт (BR-001)', () => {
  it('счёт выставлен — тариф прежний, в строке «ждёт оплаты»; подтверждение оплаты меняет тариф', async () => {
    const { user, d } = await openPlanChange('Умед Плюс')
    const pending = await issueInvoice(user, d, /^Про/)
    expect(await screen.findByText(/Счёт INV-\d+ выставлен на 900 сомони\. Тариф сменится после оплаты/)).toBeInTheDocument()
    expect(pending).toHaveTextContent('Смена тарифа: «Базовый» → «Про» (1 мес)')
    expect(pending).toHaveTextContent('Причина: Центр растёт')
    await waitFor(() => expect(rowOf('Умед Плюс')).toHaveTextContent('→ Про · ждёт оплаты'))
    expect(within(d).getByRole('region', { name: 'Сейчас' })).toHaveTextContent('Тариф «Базовый»')
    expect(d).toHaveTextContent('Выставлен счёт · Центр растёт')

    await user.click(within(pending).getByRole('button', { name: 'Подтвердить оплату…' }))
    const pay = await screen.findByRole('dialog', { name: 'Подтвердить поступление оплаты' })
    const amount = await within(pay).findByLabelText(/Сумма поступления, сомони/)
    expect(amount).toHaveValue(900)
    expect(pay).toHaveTextContent('Тариф центра изменится сразу после подтверждения оплаты.')
    await user.type(within(pay).getByLabelText(/№ платёжного поручения/), 'ПП № 512')
    await user.click(within(pay).getByRole('checkbox', { name: /деньги фактически поступили на расчётный счёт/ }))
    await user.click(within(pay).getByRole('button', { name: 'Подтвердить оплату' }))

    expect(await screen.findByText(/Оплата по INV-\d+ получена: тариф центра «Умед Плюс» изменён на «Про»/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(rowOf('Умед Плюс')).not.toHaveTextContent('ждёт оплаты'))
    expect(within(rowOf('Умед Плюс')).getAllByRole('cell')[1]).toHaveTextContent('Про')
    const audit = await mock.audit.list({})
    expect(audit.items.some((e: { action: string; entity: { name: string } }) => e.action === 'plan.changed' && e.entity.name === 'Умед Плюс')).toBe(true)
  })

  it('подтверждение оплаты: сумма не совпадает со счётом — ошибка под полем', async () => {
    const { user, d } = await openPlanChange('Indigo Academy')
    const pending = await issueInvoice(user, d, /^Про/)
    await user.click(within(pending).getByRole('button', { name: 'Подтвердить оплату…' }))
    const pay = await screen.findByRole('dialog', { name: 'Подтвердить поступление оплаты' })
    const amount = await within(pay).findByLabelText(/Сумма поступления, сомони/)
    await user.clear(amount)
    await user.type(amount, '500')
    await user.type(within(pay).getByLabelText(/№ платёжного поручения/), 'ПП № 7')
    await user.click(within(pay).getByRole('checkbox', { name: /деньги фактически поступили/ }))
    await user.click(within(pay).getByRole('button', { name: 'Подтвердить оплату' }))
    expect(await within(pay).findByText(/Сумма поступления должна совпадать со счётом \(900 сомони\)/)).toBeInTheDocument()
  })

  it('отмена счёта: без причины — отказ; с причиной — счёт отменён, снова выбор тарифа (BR-004)', async () => {
    const { user, d } = await openPlanChange('Sitora Kids')
    const pending = await issueInvoice(user, d, /^Бизнес/)
    await user.click(within(pending).getByRole('button', { name: 'Отменить счёт' }))
    const cancel = await screen.findByRole('dialog', { name: /^Отмена счёта · INV-\d+$/ })
    await user.click(within(cancel).getByRole('button', { name: 'Отменить счёт' }))
    expect(await within(cancel).findByText('Минимум 5 символов')).toBeInTheDocument()
    await user.type(within(cancel).getByLabelText(/Причина отмены/), 'Владелец передумал')
    await user.click(within(cancel).getByRole('button', { name: 'Отменить счёт' }))
    expect(await screen.findByText(/Счёт INV-\d+ отменён/)).toBeInTheDocument()
    await waitFor(() => expect(within(d).queryByRole('region', { name: /ожидает оплаты/ })).toBeNull())
    expect(await within(d).findByRole('radiogroup', { name: 'Новый тариф' })).toBeInTheDocument()
  })

  it('демо: владелец оплатил онлайн — тариф изменён', async () => {
    const { user, d } = await openPlanChange('Zebo Lingua')
    const pending = await issueInvoice(user, d, /^Про/)
    await user.click(within(pending).getByRole('button', { name: 'Демо: владелец оплатил онлайн' }))
    expect(await screen.findByText(/Оплата по INV-\d+ получена: тариф центра «Zebo Lingua» изменён на «Про»/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('смена тарифа с немедленным применением', () => {
  it('списать с баланса: тариф сразу, баланс уменьшен', async () => {
    const { user, d } = await openPlanChange('Центр Перспектива')
    await user.click(radio(d, /^Про/))
    await user.click(radio(d, /^Списать с баланса на платформе/))
    expect(norm(d.textContent)).toContain('Баланс 2 400 сомони · доступно 4 400 сомони. После списания: 1 500 сомони.')
    expect(norm(d.textContent)).toContain('С баланса на платформе будет списано 900 сомони за 1 месяц нового тарифа; тариф сменится сразу.')
    await user.type(within(d).getByLabelText(/Причина смены/), 'Сокращение филиалов')
    await user.click(within(d).getByRole('button', { name: 'Сменить тариф и списать 900 сомони' }))
    expect(await screen.findByText('Центр «Центр Перспектива» переведён на тариф «Про»: с баланса на платформе списано 900 сомони')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(norm(rowOf('Центр Перспектива').textContent)).toContain('1 500 сомони'))
  })

  it('сменить сейчас, оплата позже: без подтверждения — отказ; с подтверждением — тариф сменён, счёт открыт', async () => {
    const { user, d } = await openPlanChange('Дониш')
    await user.click(radio(d, /^Бизнес/))
    await user.click(radio(d, /^Сменить сейчас, оплата позже/))
    await user.type(within(d).getByLabelText(/Причина смены/), 'Срочно нужен тариф')
    await user.click(within(d).getByRole('button', { name: 'Сменить тариф сейчас, оплата позже' }))
    expect(await within(d).findByText('Подтвердите, что тариф будет изменён до поступления оплаты')).toBeInTheDocument()
    await user.click(within(d).getByRole('checkbox', { name: /беру решение на себя/ }))
    await user.click(within(d).getByRole('button', { name: 'Сменить тариф сейчас, оплата позже' }))
    expect(await screen.findByText(/Тариф «Дониш» изменён на «Бизнес» с отсрочкой оплаты: счёт INV-\d+ открыт до/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(rowOf('Дониш')).toHaveTextContent('оплата тарифа ожидается до'))

    // повторно: открыт отсроченный счёт — вместо выбора действия со счётом, отмена вернёт тариф
    const user2 = userEvent.setup()
    await user2.click(within(rowOf('Дониш')).getByRole('button', { name: 'Действия: Дониш' }))
    await user2.click(await screen.findByRole('menuitem', { name: /Сменить тариф/ }))
    const d2 = await screen.findByRole('dialog', { name: 'Смена тарифа · Дониш' })
    const pending = await within(d2).findByRole('region', { name: /ожидает оплаты/ })
    expect(pending).toHaveTextContent('тариф уже изменён')
    expect(within(pending).getByRole('button', { name: 'Отменить счёт и вернуть тариф' })).toBeInTheDocument()
  })

  it('бесплатный тариф: без счёта и выбора оплаты, сразу', async () => {
    const { user, d } = await openPlanChange('Рушд') // 3 сотрудника, 2 ГБ, 1 филиал — вмещается в «Старт»
    await user.click(radio(d, /^Старт/))
    expect(within(d).queryByRole('radiogroup', { name: 'Как оплатить' })).toBeNull()
    expect(d).toHaveTextContent('Тариф «Старт» бесплатный: счёт не нужен, тариф сменится сразу.')
    await user.type(within(d).getByLabelText(/Причина смены/), 'Центр сократился')
    await user.click(within(d).getByRole('button', { name: 'Перевести на «Старт»' }))
    expect(await screen.findByText('Центр «Рушд» переведён на тариф «Старт»')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(rowOf('Рушд')).toHaveTextContent('Старт (бесплатно)'))
  })
})
