import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-[0.04em] uppercase transition-colors',
  {
    variants: {
      variant: {
        brand: 'border-brand-200 bg-brand-100 text-brand-900',
        navy: 'border-navy-200 bg-navy-50 text-navy-800',
        outline: 'border-line bg-white text-ink-soft',
        light: 'border-white/25 bg-white/10 text-brand-100 backdrop-blur-sm',
        solid: 'border-transparent bg-navy-800 text-white',
        'brand-solid': 'border-transparent bg-brand-600 text-white',
      },
      size: {
        sm: 'px-2.5 py-1 text-[0.75rem]',
        md: 'px-3.5 py-1.5 text-[0.75rem]',
      },
    },
    defaultVariants: { variant: 'brand', size: 'md' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
