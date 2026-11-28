/* Вход (SYS-ACC-010), восстановление пароля по SMS-коду (SYS-ACC-030), заявка центра (PLT-CTR-070).
   mock общий для файла: у каждого теста свой аккаунт — данные для входа выдаются через mock, как это делает платформа или администратор центра. */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api as mock } from '@/api/mock/prototype-api'
import { renderRoute } from '@/test/render-route'

type User = ReturnType<typeof userEvent.setup>
type Creds = { login: string; password: string }

const ownerCreds = (centerId: number): Promise<Creds> => mock.centers.adminAccess(centerId, { reason: 'Тестовая выдача доступа' })
const card = () => screen.getByRole('main')

async function logIn(user: User, c: Creds) {
  await user.clear(screen.getByLabelText('Логин'))
  await user.type(screen.getByLabelText('Логин'), c.login)
  await user.type(screen.getByLabelText('Пароль'), c.password)
  await user.click(screen.getByRole('button', { name: 'Войти' }))
}
async function changePassword(user: User, next: string, repeat = next) {
  await screen.findByRole('heading', { name: 'Смените временный пароль' })
  await user.type(screen.getByLabelText('Новый пароль'), next)
  await user.type(screen.getByLabelText('Повторите пароль'), repeat)
  await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))
}

describe('вход (SYS-ACC-010)', () => {
  it('неверный пароль и несуществующий логин — одно сообщение; пароль стирается (критерий 2)', async () => {
    const user = userEvent.setup()
    const c = await ownerCreds(2)
    renderRoute('/login')
    await logIn(user, { login: c.login, password: 'wrong-pass' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный логин или пароль')
    expect(screen.getByLabelText('Пароль')).toHaveValue('')
    await logIn(user, { login: 'no-such-login', password: 'whatever1' })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Неверный логин или пароль'))
  })

  it('временный пароль: смена с проверками, затем кабинет своего центра (критерии 1, 5)', async () => {
    const user = userEvent.setup()
    const c = await ownerCreds(2)
    const { router } = renderRoute('/login')
    await logIn(user, c)
    await changePassword(user, 'Secret2026', 'Secret2027')
    expect(await screen.findByText('Пароли не совпадают')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Новый пароль'))
    await user.clear(screen.getByLabelText('Повторите пароль'))
    await user.type(screen.getByLabelText('Новый пароль'), 'short')
    await user.type(screen.getByLabelText('Повторите пароль'), 'short')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))
    expect(await screen.findByText('Не короче 8 символов, с буквой и цифрой')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Новый пароль'))
    await user.clear(screen.getByLabelText('Повторите пароль'))
    await user.type(screen.getByLabelText('Новый пароль'), 'Secret2026')
    await user.type(screen.getByLabelText('Повторите пароль'), 'Secret2026')
    await user.click(screen.getByRole('button', { name: 'Сохранить и войти' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/center/profile'))
    expect(new URLSearchParams(router.state.location.search).get('center')).toBe('2')
    expect(JSON.parse(sessionStorage.getItem('liniya.session')!)).toMatchObject({ login: c.login, centerId: 2 })
  })

  it('демо-доступ: «Подставить» заполняет поля, вход просит сменить временный пароль', async () => {
    const user = userEvent.setup()
    renderRoute('/login')
    await user.click(screen.getByRole('button', { name: 'Подставить' }))
    expect(screen.getByLabelText('Логин')).toHaveValue('992901001001')
    expect(screen.getByLabelText('Пароль')).toHaveValue('Demo2026')
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByRole('heading', { name: 'Смените временный пароль' })).toBeInTheDocument()
  })

  it('преподаватель: веб-кабинета нет — пояснение про мобильное приложение (критерий 4)', async () => {
    const user = userEvent.setup()
    const c: Creds = await mock.cabinet.access.reset(2, { kind: 'staff', id: 15, login: 'farhod.teacher', reason: 'Выдача доступа преподавателю' })
    const { router } = renderRoute('/login')
    await logIn(user, c)
    await changePassword(user, 'Teacher2026')
    expect(await screen.findByRole('heading', { name: 'Фарход Юсупов, вход выполнен' })).toBeInTheDocument()
    expect(card()).toHaveTextContent('Роль «Преподаватель» работает в мобильном приложении')
    expect(router.state.location.pathname).toBe('/login')
    await user.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(sessionStorage.getItem('liniya.session')).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Вход в кабинет центра' })).toBeInTheDocument()
  })

  it('пять неверных паролей — блокировка даже с верным паролем (критерий 3)', async () => {
    const user = userEvent.setup()
    const c = await ownerCreds(4)
    renderRoute('/login')
    for (let i = 0; i < 5; i++) {
      await logIn(user, { login: c.login, password: `wrong${i}` })
      await screen.findByRole('alert')
    }
    await logIn(user, c)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Слишком много неудачных попыток/))
  })

  it('ссылки: «Забыли пароль?» с логином и заявка на подключение', async () => {
    const user = userEvent.setup()
    renderRoute('/login')
    await user.type(screen.getByLabelText('Логин'), 'my.login')
    expect(screen.getByRole('link', { name: 'Забыли пароль?' })).toHaveAttribute('href', '/reset-password?login=my.login')
    expect(screen.getByRole('link', { name: 'Оставить заявку на подключение' })).toHaveAttribute('href', '/register')
    expect(document.title).toBe('Вход в кабинет центра · ЛИНИЯ')
  })
})

describe('восстановление пароля по SMS-коду (SYS-ACC-030)', () => {
  it('код и новый пароль: ошибки под полями, затем вход с новым паролем', async () => {
    const user = userEvent.setup()
    const c = await ownerCreds(3)
    const { router } = renderRoute(`/reset-password?login=${c.login}`)
    expect(screen.getByLabelText('Логин')).toHaveValue(c.login)
    await user.click(screen.getByRole('button', { name: 'Получить код' }))
    const demo = await screen.findByText(/Демо: SMS не отправляется, код — \d{6}/)
    const code = demo.textContent!.match(/\d{6}/)![0]
    expect(screen.getByText(/Повторно — через \d+ с/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Код из SMS'), code === '000000' ? '111111' : '000000')
    await user.type(screen.getByLabelText('Новый пароль'), 'weak')
    await user.type(screen.getByLabelText('Повторите пароль'), 'weak')
    await user.click(screen.getByRole('button', { name: 'Сменить пароль' }))
    expect(await screen.findByText('Неверный или просроченный код')).toBeInTheDocument()
    expect(screen.getByText('Не короче 8 символов, с буквой и цифрой', { selector: '[role=alert]' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Код из SMS'))
    await user.type(screen.getByLabelText('Код из SMS'), code)
    await user.clear(screen.getByLabelText('Новый пароль'))
    await user.clear(screen.getByLabelText('Повторите пароль'))
    await user.type(screen.getByLabelText('Новый пароль'), 'Restored2026')
    await user.type(screen.getByLabelText('Повторите пароль'), 'Restored2026')
    await user.click(screen.getByRole('button', { name: 'Сменить пароль' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await screen.findByRole('status')).toHaveTextContent('Пароль изменён. Войдите с новым паролем.')
    expect(screen.getByLabelText('Логин')).toHaveValue(c.login)
    await user.type(screen.getByLabelText('Пароль'), 'Restored2026')
    await user.click(screen.getByRole('button', { name: 'Войти' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/center/profile')) // временного пароля больше нет — сразу кабинет

    const audit = await mock.audit.list({})
    expect(audit.items.some((e: { action: string }) => e.action === 'auth.password_reset')).toBe(true)
  })

  it('несуществующий логин — тот же ответ (нельзя узнать, есть ли логин); повторно раньше 60 с — отказ', async () => {
    const user = userEvent.setup()
    renderRoute('/reset-password')
    await user.type(screen.getByLabelText('Логин'), 'ghost.user')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))
    expect(await screen.findByText('Если логин ghost.user есть на платформе, на его телефон отправлен код. Он действует 10 минут.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Другой логин' }))
    await user.click(screen.getByRole('button', { name: 'Получить код' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Код уже отправлен\. Повторно — через \d+ с/)
  })

  it('пустой логин — ошибка под полем', async () => {
    const user = userEvent.setup()
    renderRoute('/reset-password')
    await user.click(screen.getByRole('button', { name: 'Получить код' }))
    expect(await screen.findByText('Укажите логин')).toBeInTheDocument()
    expect(screen.getByLabelText('Логин')).toHaveFocus()
  })
})

describe('заявка центра на подключение (PLT-CTR-070)', () => {
  it('пустая форма — ошибки под полями, фокус на первом', async () => {
    const user = userEvent.setup()
    renderRoute('/register')
    await within(await screen.findByLabelText(/Город/)).findByRole('option', { name: 'Душанбе' })
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }))
    expect(await screen.findByText('Название — от 2 до 80 символов')).toBeInTheDocument()
    for (const text of ['Выберите город', 'Выберите направление', 'Укажите имя и фамилию', 'Номер в формате +992 и 9 цифр', 'Нужно согласие на обработку данных'])
      expect(screen.getByText(text, { selector: '[role=alert]' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Название центра/)).toHaveFocus()
  })

  it('занятое название — отказ; верная заявка — номер и что будет дальше', async () => {
    const user = userEvent.setup()
    renderRoute('/register')
    await within(await screen.findByLabelText(/Город/)).findByRole('option', { name: 'Худжанд' })
    await user.type(screen.getByLabelText(/Название центра/), 'Alpha School')
    await user.selectOptions(screen.getByLabelText(/Город/), 'Худжанд')
    await user.selectOptions(screen.getByLabelText(/Основное направление/), 'Математика')
    await user.type(screen.getByLabelText(/Ваше имя и фамилия/), 'Сомон Каримов')
    await user.type(screen.getByLabelText(/Телефон/), '+992 93 555 12 34')
    await user.click(screen.getByRole('checkbox', { name: /обработку персональных данных/ }))
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }))
    expect(await screen.findByText('Центр с таким названием уже подключён к платформе')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Название центра/))
    await user.type(screen.getByLabelText(/Название центра/), 'Академия Сомон')
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }))
    expect(await screen.findByRole('heading', { name: /^Заявка APP-\d+ отправлена$/ })).toBeInTheDocument()
    expect(card()).toHaveTextContent('свяжется с вами по телефону +992 93 555 12 34')
    expect(screen.getByRole('link', { name: 'Вернуться ко входу' })).toHaveAttribute('href', '/login')
    const audit = await mock.audit.list({})
    expect(audit.items[0]).toMatchObject({ action: 'center.application', entity: { name: 'Академия Сомон' } })
  })
})
