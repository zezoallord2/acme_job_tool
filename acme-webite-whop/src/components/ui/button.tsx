import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-[transform,background-color,color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-60 active:translate-y-px select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary:
          'bg-navy-800 text-white shadow-[0_10px_30px_-14px_rgba(11,45,77,0.85)] hover:bg-navy-700 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-16px_rgba(11,45,77,0.7)]',
        accent:
          'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-[0_10px_30px_-14px_rgba(17,142,148,0.9)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-16px_rgba(17,142,148,0.75)]',
        outline:
          'border border-navy-200 bg-white/85 text-navy-800 backdrop-blur-sm hover:border-brand-500 hover:bg-white hover:-translate-y-0.5',
        'outline-light':
          'border border-white/30 bg-white/10 text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/15 hover:-translate-y-0.5',
        ghost: 'text-navy-800 hover:bg-navy-50',
        link: 'text-brand-800 underline underline-offset-4 decoration-brand-400 hover:decoration-brand-700 rounded-none',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-[0.95rem]',
        lg: 'h-13 px-7 text-base',
        xl: 'h-14 px-8 text-[1.0625rem]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
