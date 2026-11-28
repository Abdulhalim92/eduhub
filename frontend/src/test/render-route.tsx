/* Открыть приложение на адресе — те же маршруты, что в браузере, но в памяти (без адресной строки).
   Свой store на каждый рендер: кеш запросов не переходит между тестами. Данные — mock прототипа через mockFetch (VITE_API_MODE ≠ http). */
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { routes } from '@/app/router'
import { makeStore } from '@/app/store'
import { Toaster } from '@/components/ui/sonner'

export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const store = makeStore()
  return {
    router,
    store,
    ...render(
      <Provider store={store}>
        <RouterProvider router={router} />
        <Toaster />
      </Provider>,
    ),
  }
}
