import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // данные экрана свежие 30 с: переход туда-обратно не дёргает api
        retry: 1, // одна повторная попытка, затем — ошибка с кнопкой «Повторить»
        refetchOnWindowFocus: false,
      },
    },
  })
}
