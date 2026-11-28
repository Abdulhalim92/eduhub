import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderRoute } from '@/test/render-route'

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const main = () => screen.getByRole('main')
const rows = () => within(main()).getAllByRole('button', { name: /^Открыть карточку: / })
const names = () => rows().map(b => b.getAttribute('aria-label')!.replace('Открыть карточку: ', ''))
const rowOf = (name: string) => within(main()).getByRole('button', { name: `Открыть карточку: ${name}` }).closest('li')!
const tile = (label: string) => norm(within(main()).getByText(label).parentElement?.textContent)
const loaded = () => within(main()).findByRole('button', { name: 'Открыть карточку: Zebo Lingua' })
const summary = () => norm(within(main()).getByText(/^Будет выставлен счёт на/).textContent)

// Порядок тестов значим: предложения и счета из ранних тестов видны в поздних.
describe('центры у лимита (PLT-TRF-040)', () => {
  it('порог 80 %: 6 центров по загрузке, плитки, карточка первого с рекомендуемым тарифом', async () => {
    renderRoute('/platform/limits')
    expect(within(main()).getByRole('heading', { level: 1 })).toHaveTextContent('Центры у лимита')
    await loaded()
    expect(names()).toEqual(['Zebo Lingua', 'Math Lab', 'Умед Плюс', 'Sitora Kids', 'Дониш', 'Kids Planet'])
    expect(tile('У лимита')).toContain('6порог 80% и выше')
    expect(tile('Лимит исчерпан')).toContain('2')
    expect(tile('Предложение отправлено')).toContain('1 из 6без предложения: 5')
    expect(tile('Потенциал допродаж')).toContain('3 700 сомони')
    expect(rowOf('Zebo Lingua')).toHaveTextContent('100%')
    expect(rowOf('Zebo Lingua')).toHaveTextContent('→ Про')
    expect(rowOf('Дониш')).toHaveTextContent('Предложено')
    expect(within(main()).getByRole('button', { name: 'Без предложения · 5' })).toBeInTheDocument()

    // карточка выбранного (первого) центра
    expect(within(main()).getByRole('heading', { level: 2 })).toHaveTextContent('Zebo Lingua')
    const usage = within(main()).getByRole('region', { name: 'Использование лимитов' })
    expect(usage).toHaveTextContent('Филиалыограничивает')
    expect(usage).toHaveTextContent('3 из 3 · 100%')
    const plans = within(main()).getByRole('radiogroup', { name: 'Куда перевести' })
    expect(within(plans).getByRole('radio', { name: /Про/ })).toBeChecked()
    expect(summary()).toContain('Будет выставлен счёт на 900 сомони (на 500 сомони больше текущего тарифа)')
  })

  it('порог 90 %: только центры с загрузкой от 90 %, порог в адресе', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/limits')
    await loaded()
    await user.click(within(main()).getByRole('button', { name: '90%' }))
    await waitFor(() => expect(names()).toEqual(['Zebo Lingua', 'Math Lab', 'Умед Плюс', 'Sitora Kids']))
    expect(router.state.location.search).toBe('?th=90')
    expect(tile('У лимита')).toContain('4порог 90% и выше')
  })

  it('выбор центра открывает его карточку; другой тариф меняет сумму', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/limits')
    await loaded()
    await user.click(within(main()).getByRole('button', { name: 'Открыть карточку: Умед Плюс' }))
    expect(within(main()).getByRole('heading', { level: 2 })).toHaveTextContent('Умед Плюс')
    expect(rowOf('Умед Плюс')).toHaveAttribute('aria-current', 'true')
    await user.click(within(main()).getByRole('radio', { name: /Бизнес/ }))
    expect(within(main()).getByRole('button', { name: 'Выставить счёт на «Бизнес»…' })).toBeEnabled()
    expect(summary()).toContain('Будет выставлен счёт на 1 800 сомони')
  })

  it('массовое предложение: отправлено двоим, статус «Предложено», отметки сняты', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/limits')
    await loaded()
    await user.click(within(main()).getByRole('checkbox', { name: 'Выбрать Math Lab' }))
    await user.click(within(main()).getByRole('checkbox', { name: 'Выбрать Kids Planet' }))
    expect(norm(within(main()).getByText(/^Выбрано:/).textContent)).toBe('Выбрано: 2 из 6')
    await user.click(within(main()).getByRole('button', { name: 'Отправить предложение (2)' }))
    expect(await screen.findByText('Предложений отправлено: 2')).toBeInTheDocument()
    await waitFor(() => expect(rowOf('Math Lab')).toHaveTextContent('Предложено'))
    expect(rowOf('Kids Planet')).toHaveTextContent('Предложено')
    await waitFor(() => expect(tile('Предложение отправлено')).toContain('3 из 6'))
    expect(within(main()).queryByRole('button', { name: /^Отправить предложение \(/ })).toBeNull()
  })

  it('«Выставить счёт…» открывает смену тарифа с выбранным тарифом и причиной; после счёта — «Ожидает оплаты»', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/limits')
    await loaded()
    await user.click(within(main()).getByRole('button', { name: 'Выставить счёт на «Про»…' }))
    const d = await screen.findByRole('dialog', { name: 'Смена тарифа · Zebo Lingua' })
    expect(await within(d).findByRole('radio', { name: /^Про/ })).toBeChecked()
    expect(within(d).getByLabelText(/Причина смены/)).toHaveValue('Лимит «Филиалы» исчерпан: 3 из 3 (100%)')
    await user.click(within(d).getByRole('button', { name: 'Выставить счёт на 900 сомони' }))
    await within(d).findByRole('region', { name: /ожидает оплаты/ })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(rowOf('Zebo Lingua')).toHaveTextContent('Ожидает оплаты'))
    const pending = within(main()).getByRole('region', { name: 'Ожидает оплаты' })
    expect(pending).toHaveTextContent(/Счёт INV-\d+ на тариф «Про» ожидает оплаты · 900 сомони/)
    expect(within(pending).getByRole('button', { name: 'Подтвердить оплату…' })).toBeInTheDocument()
  })
})
