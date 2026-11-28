/* Подпись роли для экранов входа. Сервер присылает подпись при входе по паролю; при входе по SMS-коду — только код роли. */
import { useTranslation } from 'react-i18next'

const KNOWN = ['owner', 'admin', 'center_admin', 'teacher', 'student', 'parent', 'superadmin'] as const
type KnownRole = (typeof KNOWN)[number]

export function useRoleLabel() {
  const { t } = useTranslation()
  return (role: string, fromServer?: string) =>
    fromServer || ((KNOWN as readonly string[]).includes(role) ? t(`auth.roles.${role as KnownRole}`) : role)
}
