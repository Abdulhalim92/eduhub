import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/sonner'
import { createAppRouter } from './router'
import { makeStore } from './store'

const store = makeStore()
const router = createAppRouter()

export function App() {
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" />
    </Provider>
  )
}
