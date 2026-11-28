/* Вход SuperAdmin в кабинет центра (режим поддержки, PLT-CTR-050). Сначала запись в журнал аудита, потом переход:
   без записи вход не выполняется (NFR-SEC-030). Прототип входил и при ошибке журнала — здесь так нельзя. */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { errorMessage } from '@/api/errors'
import { useEnterSupportMutation } from './api/supportApi'

export const supportUrl = (centerId: number) => `/center/profile?center=${centerId}&support=1`

export function useEnterSupportNav() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [enterSupport, state] = useEnterSupportMutation()
  const enter = async (centerId: number) => {
    try {
      await enterSupport(centerId).unwrap()
      navigate(supportUrl(centerId))
    } catch (e) {
      toast.error(errorMessage(e, t('support.failed')))
    }
  }
  return { enter, pendingId: state.isLoading ? state.originalArgs : undefined }
}
