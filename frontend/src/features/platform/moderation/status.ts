import type { ModerationStatus } from '@/features/platform/moderation/api/types'
import type { BadgeTone } from '@/components/StatusBadge'

export const MOD_STATUS_TONE: Record<ModerationStatus, BadgeTone> = {
  pending: 'amber',
  published: 'emerald',
  returned: 'amber',
  rejected: 'rose',
}
