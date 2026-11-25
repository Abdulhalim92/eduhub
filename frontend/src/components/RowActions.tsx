/* Шестерёнка «Действия» в строке таблицы (ui-principles: одно главное действие + меню). Пункты — только работающие действия. */
import { ChevronDown, Settings, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type RowAction = { label: string; hint?: string; icon: LucideIcon; onSelect: () => void }

export function RowActions({ label, actions }: { label: string; actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label}>
          <Settings aria-hidden />
          <ChevronDown className="text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {actions.map(a => {
          const Icon = a.icon
          return (
            <DropdownMenuItem key={a.label} onSelect={a.onSelect} className="items-start">
              <Icon className="mt-0.5" aria-hidden />
              <span className="flex flex-col">
                <span>{a.label}</span>
                {a.hint && <span className="text-[11px] text-muted-foreground">{a.hint}</span>}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
