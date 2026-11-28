/* Пункты бокового меню. Порядок и группы — как в прототипе (src/js/core/nav.js — SUPER_NAV; eduhub.html — порядок экранов кабинета).
   Активный пункт — точное совпадение адреса или handle.parent экрана (useActiveNavPath), а не префикс:
   иначе «Все центры» (/platform/centers) горели бы вместе с «Подключить центр» (/platform/centers/new). */
import {
  Award, BookOpen, Building, Building2, Calendar, ChartColumn, ChartPie, Clock, CreditCard, Layers, LayoutDashboard,
  LayoutGrid, MapPin, Megaphone, MessageSquareMore, Plus, Settings, ShieldCheck, ShoppingCart, SlidersVertical,
  TrendingUp, TriangleAlert, UserCog, Users, Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Translation } from '@/i18n/locales/ru'
import type { ScreenKey } from './route-handle'

export type NavItem = {
  to: string
  title: ScreenKey
  icon: LucideIcon
}

export type NavGroup = {
  id: keyof Translation['nav']['groups']
  /** Раскрыта ли секция, пока пользователь сам её не свернул или не раскрыл. */
  defaultOpen: boolean
  items: NavItem[]
}

export const PLATFORM_NAV: NavGroup[] = [
  {
    id: 'platform',
    defaultOpen: true,
    items: [
      { to: '/platform', title: 'screens.platform.home', icon: LayoutGrid },
      { to: '/platform/centers', title: 'screens.platform.centers', icon: Building2 },
      { to: '/platform/centers/new', title: 'screens.platform.centerNew', icon: Plus },
    ],
  },
  {
    id: 'attention',
    defaultOpen: true,
    items: [
      { to: '/platform/moderation', title: 'screens.platform.moderation', icon: MapPin },
      { to: '/platform/expiring', title: 'screens.platform.expiring', icon: Clock },
      { to: '/platform/churn', title: 'screens.platform.churn', icon: TriangleAlert },
      { to: '/platform/limits', title: 'screens.platform.limits', icon: TrendingUp },
    ],
  },
  {
    id: 'monetization',
    defaultOpen: false,
    items: [
      { to: '/platform/plans', title: 'screens.platform.plans', icon: ChartPie },
      { to: '/platform/billing', title: 'screens.platform.billing', icon: CreditCard },
      { to: '/platform/marketplace', title: 'screens.platform.marketplace', icon: ShoppingCart },
      { to: '/platform/sms', title: 'screens.platform.sms', icon: MessageSquareMore },
    ],
  },
  {
    id: 'system',
    defaultOpen: false,
    items: [
      { to: '/platform/broadcast', title: 'screens.platform.broadcast', icon: Megaphone },
      { to: '/platform/audit', title: 'screens.platform.audit', icon: ShieldCheck },
      { to: '/platform/settings', title: 'screens.platform.settings', icon: Settings },
    ],
  },
]

export const CENTER_NAV: NavItem[] = [
  { to: '/center/dashboard', title: 'screens.center.dashboard', icon: LayoutDashboard },
  { to: '/center/profile', title: 'screens.center.profile', icon: Building },
  { to: '/center/users', title: 'screens.center.users', icon: Users },
  { to: '/center/staff', title: 'screens.center.staff', icon: UserCog },
  { to: '/center/branches', title: 'screens.center.branches', icon: MapPin },
  { to: '/center/courses', title: 'screens.center.courses', icon: BookOpen },
  { to: '/center/groups', title: 'screens.center.groups', icon: Layers },
  { to: '/center/schedule', title: 'screens.center.schedule', icon: Calendar },
  { to: '/center/rewards', title: 'screens.center.rewards', icon: Award },
  { to: '/center/coin-rules', title: 'screens.center.coinRules', icon: SlidersVertical },
  { to: '/center/analytics', title: 'screens.center.analytics', icon: ChartColumn },
  { to: '/center/balance', title: 'screens.center.balance', icon: Wallet },
]
