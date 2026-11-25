/* Открыть приложение на адресе — те же маршруты, что в браузере, но в памяти (без адресной строки).
   Свой QueryClient на каждый рендер: кеш запросов не переходит между тестами; без повторов — ошибка видна сразу. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { routes } from '@/app/router'
import { Toaster } from '@/components/ui/sonner'

export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    router,
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>,
    ),
  }
}
