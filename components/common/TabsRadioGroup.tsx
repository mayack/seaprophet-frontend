import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  defaultValue: string
  options: Array<{ value: string; label: string }>
  onValueChange?: (value: string) => void
}

export function TabsRadioGroup({
  name,
  defaultValue,
  options,
  className,
  onValueChange,
}: TabsRadioGroupProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange?.(event.target.value)
  }

  return (
    <div
      role="group"
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md bg-muted p-1',
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((option) => (
        <label key={option.value} className="relative h-full flex-1">
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            onChange={handleChange}
            className="peer absolute h-0 w-0 opacity-0"
          />
          <span className="flex h-full w-full cursor-pointer select-none items-center justify-center rounded-sm px-4 text-sm font-medium text-muted-foreground ring-offset-background transition-all hover:text-foreground peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
