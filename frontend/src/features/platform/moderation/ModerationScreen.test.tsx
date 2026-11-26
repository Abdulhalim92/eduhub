import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

const main = () => screen.getByRole('main')
const cards = () => within(main()).queryAllByRole('button', { name: /^Открыть заявку: / })
const names = () => cards().map(b => b.getAttribute('aria-label')!.replace('Открыть заявку: ', ''))
const cardOf = (name: string) => within(main()).getByRole('button', { name: `Открыть заявку: ${name}` })
const publish = () => within(main()).getByRole('button', { name: 'Одобрить и опубликовать' })
const confirmPin = () => within(main()).getByRole('checkbox', { name: /Я проверил\(а\) координаты на карте/ })
const checks = () => within(main()).getByRole('region', { name: 'Проверки' })
const loaded = () => within(main()).findByRole('button', { name: 'Открыть заявку: Центр Перспектива — Филиал «Сино»' })

// Порядок тестов значим: решения из ранних тестов видны в поздних (mock в памяти).
describe('модерация каталога (PLT-MOD)', () => {
  it('очередь: 4 заявки на проверке, метки «GPS расходится» и «Нет TJ», первая открыта', async () => {
    renderRoute('/platform/moderation')
    expect(within(main()).getByRole('heading', { level: 1 })).toHaveTextContent('Модерация каталога на карте')
    await loaded()
    expect(names()).toEqual([
      'Центр Перспектива — Филиал «Сино»',
      'Sitora Kids — Филиал «Фирдавси»',
      'Дониш — Главный филиал',
      'Zebo Lingua — Филиал «Центр»',
    ])
    expect(within(main()).getByRole('heading', { name: 'Заявки на публикацию (4)' })).toBeInTheDocument()
    expect(within(main()).getByRole('button', { name: 'Ожидают · 4' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(main()).getByRole('button', { name: 'Обработаны · 0' })).toBeInTheDocument()
    expect(cardOf('Sitora Kids — Филиал «Фирдавси»')).toHaveTextContent('GPS расходится')
    expect(cardOf('Дониш — Главный филиал')).toHaveTextContent('Нет TJ')
    expect(cardOf('Центр Перспектива — Филиал «Сино»')).not.toHaveTextContent('GPS расходится')
    expect(cardOf('Центр Перспектива — Филиал «Сино»')).toHaveAttribute('aria-current', 'true')
    expect(within(main()).getByText(/отправил\(а\) Анна Смирнова · сегодня, 09:40/)).toBeInTheDocument()
  })

  it('расхождение больше 150 м: величина показана в проверке адреса', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/moderation')
    await loaded()
    await user.click(cardOf('Sitora Kids — Филиал «Фирдавси»'))
    expect(checks()).toHaveTextContent(/Расхождение с геокодером \d+ м \(порог 150 м\)/)
  })

  it('без подтверждения пина публикация недоступна и причина показана; правка координат сбрасывает подтверждение', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/moderation')
    await loaded()
    await user.click(cardOf('Zebo Lingua — Филиал «Центр»'))
    expect(publish()).toBeDisabled()
    expect(within(main()).getByText('Для публикации: подтвердите координаты на карте')).toBeInTheDocument()
    await user.click(confirmPin())
    expect(publish()).toBeEnabled()
    expect(within(main()).getByText('Все условия публикации выполнены')).toBeInTheDocument()

    const lat = within(main()).getByRole('spinbutton', { name: 'Широта' })
    fireEvent.change(lat, { target: { value: '40.2900' } })
    fireEvent.blur(lat)
    await waitFor(() => expect(confirmPin()).not.toBeChecked())
    expect(publish()).toBeDisabled()
    expect(within(main()).getByText(/^Координаты:/).parentElement).toHaveTextContent('40.2900° N')
  })

  it('нет описания TJ — публикация недоступна; после заполнения и подтверждения — доступна', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/moderation')
    await loaded()
    await user.click(cardOf('Дониш — Главный филиал'))
    await user.click(confirmPin())
    expect(publish()).toBeDisabled()
    expect(within(main()).getByText('Для публикации: описание TJ обязательно (от 20 символов)')).toBeInTheDocument()
    await user.type(within(main()).getByLabelText('Описание TJ'), 'Барномасозӣ ва робототехника барои наврасон')
    expect(publish()).toBeEnabled()
  })

  it('публикация: заявка уходит из очереди, счётчик уменьшается, решение в журнале аудита', async () => {
    const user = userEvent.setup()
    renderRoute('/platform/moderation')
    await loaded()
    await user.click(confirmPin())
    await user.click(publish())
    expect(await screen.findByText('Филиал «Сино» (Центр Перспектива) опубликован в каталоге')).toBeInTheDocument()
    await waitFor(() => expect(names()).not.toContain('Центр Перспектива — Филиал «Сино»'))
    expect(within(main()).getByRole('button', { name: 'Ожидают · 3' })).toBeInTheDocument()
    expect(within(main()).getByRole('button', { name: 'Обработаны · 1' })).toBeInTheDocument()
    const audit = await mock.audit.list({})
    expect(audit.items.some((e: { action: string }) => e.action === 'moderation.published')).toBe(true)
  })

  it('«Вернуть на доработку» без причины отклонено; с причиной — во «Обработаны»; «Вернуть в очередь» возвращает', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/platform/moderation')
    await within(main()).findByRole('button', { name: 'Открыть заявку: Sitora Kids — Филиал «Фирдавси»' })
    await user.click(cardOf('Sitora Kids — Филиал «Фирдавси»'))
    await user.click(within(main()).getByRole('button', { name: 'Вернуть на доработку' }))
    const reason = within(main()).getByLabelText('Что нужно исправить')
    await user.type(reason, 'нет')
    await user.click(within(main()).getAllByRole('button', { name: 'Вернуть на доработку' }).at(0)!)
    expect(within(main()).getByText('Укажите причину (минимум 5 символов)')).toBeInTheDocument()
    expect(reason).toHaveAttribute('aria-invalid', 'true')

    await user.clear(reason)
    await user.type(reason, 'Пин стоит на соседнем здании')
    await user.click(within(main()).getAllByRole('button', { name: 'Вернуть на доработку' }).at(0)!)
    expect(await screen.findByText('Заявка возвращена на доработку')).toBeInTheDocument()
    await waitFor(() => expect(names()).not.toContain('Sitora Kids — Филиал «Фирдавси»'))

    await user.click(within(main()).getByRole('button', { name: 'Обработаны · 2' }))
    expect(router.state.location.search).toBe('?tab=processed')
    await user.click(await within(main()).findByRole('button', { name: 'Открыть заявку: Sitora Kids — Филиал «Фирдавси»' }))
    expect(within(main()).getByText('Причина: Пин стоит на соседнем здании')).toBeInTheDocument()
    await user.click(within(main()).getByRole('button', { name: 'Вернуть в очередь' }))
    expect(await screen.findByText('Заявка возвращена в очередь модерации')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
    await waitFor(() => expect(names()).toContain('Sitora Kids — Филиал «Фирдавси»'))
    expect(cardOf('Sitora Kids — Филиал «Фирдавси»')).toHaveAttribute('aria-current', 'true')
  })
})
