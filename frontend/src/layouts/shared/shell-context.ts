/* Мобильное меню каркаса: шапка открывает сайдбар-шторку на экранах уже 1024 px (там постоянного сайдбара нет). */
import { createContext, useContext } from 'react'

export const ShellContext = createContext<{ openNav: () => void }>({ openNav: () => {} })
export const useShell = () => useContext(ShellContext)
