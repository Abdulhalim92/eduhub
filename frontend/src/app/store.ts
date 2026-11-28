/* Redux store: пока в нём только кеш RTK Query (baseApi). Свой store на каждый рендер в тестах — кеш не переходит между ними. */
import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from '@/api/baseApi'

export function makeStore() {
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: getDefault => getDefault().concat(baseApi.middleware),
  })
  setupListeners(store.dispatch)
  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
