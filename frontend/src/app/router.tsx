/* Маршруты. Адреса прототипа (#/centers, eduhub.html#/center-groups?center=1) заменены на обычные пути:
   /platform/… — кабинет платформы, /center/… — кабинет центра. Пока экран не перенесён, на его месте ScreenPlaceholder. */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { ScreenPlaceholder } from '@/components/ScreenPlaceholder'
import { CentersScreen } from '@/features/platform/centers/CentersScreen'
import { ChurnScreen } from '@/features/platform/churn/ChurnScreen'
import { ExpiringScreen } from '@/features/platform/expiring/ExpiringScreen'
import { LimitsScreen } from '@/features/platform/limits/LimitsScreen'
import { ModerationScreen } from '@/features/platform/moderation/ModerationScreen'
import { HomeScreen } from '@/features/platform/home/HomeScreen'
import { CabinetIndexRedirect, CenterLayout } from '@/layouts/center/CenterLayout'
import { PlatformLayout } from '@/layouts/platform/PlatformLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { NotFound } from './NotFound'
import { RequireSession } from './RequireSession'
import type { RouteHandle, ScreenKey } from './route-handle'

/** Экран-заглушка: заголовок, файл прототипа (относительно src/js/views/), родитель для дочерних страниц. */
function screen(title: ScreenKey, prototype: string, parent?: RouteHandle['parent']): Pick<RouteObject, 'element' | 'handle'> {
  const handle: RouteHandle = { title, prototype, parent }
  return { element: <ScreenPlaceholder />, handle }
}

const centers = { title: 'screens.platform.centers', to: '/platform/centers' } as const
const marketplace = { title: 'screens.platform.marketplace', to: '/platform/marketplace' } as const
const courses = { title: 'screens.center.courses', to: '/center/courses' } as const
const groups = { title: 'screens.center.groups', to: '/center/groups' } as const

export const routes: RouteObject[] = [
  // до шага авторизации стартовый экран — кабинет платформы; затем — по роли пользователя
  { path: '/', element: <Navigate to="/platform" replace /> },
  // страницы без кабинета: вход (SYS-ACC-010), восстановление пароля (SYS-ACC-030), заявка центра (PLT-CTR-070)
  { path: '/login', element: <LoginPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/platform',
    element: (
      <RequireSession>
        <PlatformLayout />
      </RequireSession>
    ),
    children: [
      { index: true, element: <HomeScreen />, handle: { title: 'screens.platform.home' } satisfies RouteHandle },
      { path: 'centers', element: <CentersScreen />, handle: { title: 'screens.platform.centers' } satisfies RouteHandle },
      { path: 'centers/new', ...screen('screens.platform.centerNew', 'platform/center-new.js') },
      { path: 'centers/:centerId/people', ...screen('screens.platform.centerPeople', 'platform/center-people.js', centers) },
      { path: 'moderation', element: <ModerationScreen />, handle: { title: 'screens.platform.moderation' } satisfies RouteHandle },
      { path: 'expiring', element: <ExpiringScreen />, handle: { title: 'screens.platform.expiring' } satisfies RouteHandle },
      { path: 'churn', element: <ChurnScreen />, handle: { title: 'screens.platform.churn' } satisfies RouteHandle },
      { path: 'limits', element: <LimitsScreen />, handle: { title: 'screens.platform.limits' } satisfies RouteHandle },
      { path: 'plans', ...screen('screens.platform.plans', 'platform/plans.js') },
      { path: 'billing', ...screen('screens.platform.billing', 'platform/billing.js') },
      { path: 'marketplace', ...screen('screens.platform.marketplace', 'platform/marketplace.js') },
      { path: 'marketplace/courses/:courseId', ...screen('screens.platform.course', 'shared/course-page.js', marketplace) },
      { path: 'sms', ...screen('screens.platform.sms', 'platform/sms.js') },
      { path: 'broadcast', ...screen('screens.platform.broadcast', 'platform/broadcast.js') },
      { path: 'audit', ...screen('screens.platform.audit', 'platform/audit.js') },
      { path: 'settings', ...screen('screens.platform.settings', 'platform/settings.js') },
    ],
  },
  {
    path: '/center',
    element: (
      <RequireSession>
        <CenterLayout />
      </RequireSession>
    ),
    children: [
      // в прототипе кабинет открывается на профиле центра
      { index: true, element: <CabinetIndexRedirect /> },
      { path: 'dashboard', ...screen('screens.center.dashboard', 'cabinet/center-dashboard.js') },
      { path: 'profile', ...screen('screens.center.profile', 'cabinet/center-profile.js') },
      { path: 'users', ...screen('screens.center.users', 'cabinet/center-users.js') },
      { path: 'staff', ...screen('screens.center.staff', 'cabinet/center-staff.js') },
      { path: 'branches', ...screen('screens.center.branches', 'cabinet/center-branches.js') },
      { path: 'courses', ...screen('screens.center.courses', 'cabinet/center-courses.js') },
      { path: 'courses/:courseId', ...screen('screens.center.course', 'shared/course-page.js', courses) },
      { path: 'groups', ...screen('screens.center.groups', 'cabinet/center-groups.js') },
      { path: 'groups/:groupId', ...screen('screens.center.group', 'cabinet/center-groups.js', groups) },
      { path: 'schedule', ...screen('screens.center.schedule', 'cabinet/center-schedule.js') },
      { path: 'rewards', ...screen('screens.center.rewards', 'cabinet/center-rewards.js') },
      { path: 'coin-rules', ...screen('screens.center.coinRules', 'cabinet/center-coin-rules.js') },
      { path: 'analytics', ...screen('screens.center.analytics', 'cabinet/center-analytics.js') },
      { path: 'balance', ...screen('screens.center.balance', 'cabinet/center-balance.js') },
    ],
  },
  { path: '*', element: <NotFound /> },
]

export const createAppRouter = () => createBrowserRouter(routes)
