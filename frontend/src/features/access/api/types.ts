/** Выданные данные для входа: пароль временный, показывается один раз и нигде не хранится в открытом виде (BR-025). */
export interface IssuedCredentials {
  login: string
  password: string
  mustChange: boolean
  /** Кому выданы (владелец центра). */
  name: string
  /** Доступ уже был — это сброс пароля, логин прежний. */
  hadAccess: boolean
}
