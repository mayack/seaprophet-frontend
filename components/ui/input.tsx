import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const inputVariants = cva(
  [
    // Layout
    'h-10',
    'w-full',
    'flex',
    // Spacing & Background
    'px-3',
    'py-2',
    // Typography
    'text-base',
    'md:text-sm',
    // States & Behaviors
    'ring-offset-background',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-ring',
    'focus-visible:ring-offset-2',
    'focus-visible:bg-background',
    'disabled:cursor-not-allowed',
    'disabled:opacity-50',
    // File Input
    'file:border-0',
    'file:bg-transparent',
    'file:text-sm',
    'file:font-medium',
    'file:text-foreground',
  ].join(' '),
  {
    variants: {
      variant: {
        default: ['rounded-md', 'border', 'border-input', 'bg-background'].join(
          ' '
        ),
        muted: ['rounded-full', 'bg-muted'].join(' '),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
