'use client'

import { Slot } from '@radix-ui/react-slot'
import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'hero'

/**
 * Variants are defined once, against semantic tokens, so a control looks
 * correct in both themes without a single theme-specific override at the call
 * site. Destructive is never yellow — brand colour means action here, not
 * danger.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-brand-foreground font-semibold shadow-[var(--shadow-brand)] hover:bg-brand-hover active:bg-brand-pressed',
  secondary:
    'bg-surface text-foreground border border-border hover:border-border-strong hover:bg-surface-hover active:bg-surface',
  ghost: 'text-foreground-secondary hover:text-foreground hover:bg-surface-hover',
  danger: 'bg-danger-soft text-danger border border-danger/30 hover:border-danger/50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.78rem] rounded-[8px] gap-1.5',
  md: 'h-10 px-4 text-[0.86rem] rounded-[10px] gap-2',
  lg: 'h-12 px-6 text-[0.94rem] rounded-[11px] gap-2.5',
  hero: 'h-[3.25rem] px-7 text-[0.98rem] rounded-[12px] gap-3',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  asChild?: boolean
}

/**
 * Physical rather than flat: the control drops a pixel under the pointer, so
 * a press reads as a mechanism rather than a colour change.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap',
        'font-medium tracking-[-0.005em]',
        'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[var(--ease-physical)]',
        'active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
})
