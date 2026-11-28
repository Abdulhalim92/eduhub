/** Пользователь после входа. cabinet — есть веб-кабинет (владелец и администратор центра); остальные роли работают в мобильном приложении. */
export interface Session {
  login: string
  role: string
  roleLabel: string
  name: string
  centerId: number
  centerName: string
  /** Пароль временный — до входа его нужно сменить. */
  mustChange: boolean
  cabinet: boolean
}

/** Код восстановления отправлен (ответ одинаковый для любого логина). demoCode — только в моке, SMS-шлюза нет. */
export interface ResetRequested {
  expiresIn: number
  resendIn: number
  demoCode?: string
}

export interface CenterApplicationPayload {
  centerName: string
  city: string
  direction: string
  ownerName: string
  phone: string
  email: string
  comment: string
  consent: boolean
}

export interface CenterApplication {
  id: string
  status: 'new'
  createdAt: string
}

/** Ответ входа и смены пароля: сервер добавляет к сессии токены (mock — без них). */
export interface SessionResponse extends Session {
  token?: string
  refreshToken?: string
}

/** Вход для экрана: пользователь отдельно, токен — только для хранилища сессии. */
export interface SignedIn {
  session: Session
  token: string | null
}
