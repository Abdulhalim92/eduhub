/* Элементы панели фильтров реестров: поиск с задержкой, выпадающий список, чип быстрого фильтра. */
import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Поиск: значение уходит наружу через `delay` мс после последнего ввода (не дёргаем api на каждую букву). */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  delay = 250,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  delay?: number
}) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // значение сменили снаружи (сброс фильтров, переход «назад») — показать его в поле
  if (value !== seen) {
    setSeen(value)
    setText(value)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="relative w-72 max-w-full">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        value={text}
        aria-label={label}
        placeholder={placeholder}
        onChange={e => {
          const v = e.target.value
          setText(v)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => onChange(v.trim()), delay)
        }}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs focus:border-brand focus:bg-white focus:outline-none"
      />
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-brand focus:outline-none"
      >
        {children}
      </select>
    </label>
  )
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-1.5 text-xs font-semibold transition',
        active ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  )
}
