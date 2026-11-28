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

/* ---------- вход по телефону и SMS-коду (SYS-ACC-030, BR-035; backend/internal/modules/identity) ---------- */

/** POST /auth/otp/request. demoCode — только в демо (mock), SMS-шлюза там нет; сервер пишет код в лог. */
export interface OtpRequested {
  status: 'sent'
  demoCode?: string
}

/** Членство «человек + центр + роль». */
export interface Membership {
  tenantId: number
  tenantName: string
  role: string
  branchId?: number
}

/** Сессия входа по коду (MobileSession сервера). roleLabel и cabinet сервер пока не присылает. */
export interface OtpSessionResponse {
  accountId: number
  phone: string
  name: string
  tenantId: number
  tenantName: string
  role: string
  roleLabel?: string
  cabinet?: boolean
  studentId?: number
  token: string
  refreshToken: string
}

/** POST /auth/otp/verify: одно членство — сразу сессия; несколько или ни одного — токен выбора и список. */
export interface OtpVerifyResponse {
  session?: OtpSessionResponse
  selectToken?: string
  memberships?: Membership[]
}

/** Итог проверки кода для экрана. */
export type OtpResult = { kind: 'signedIn'; signedIn: SignedIn } | { kind: 'choose'; selectToken: string; memberships: Membership[] }

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
