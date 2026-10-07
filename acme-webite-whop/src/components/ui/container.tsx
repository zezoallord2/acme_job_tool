import * as React from 'react';
import { cn } from '@/lib/utils';

export function Container({
  className,
  size = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: 'default' | 'prose' | 'wide' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-5 sm:px-8',
        size === 'default' && 'max-w-[78rem]',
        size === 'wide' && 'max-w-[90rem]',
        size === 'prose' && 'max-w-[46rem]',
        className
      )}
      {...props}
    />
  );
}

export function Section({
  className,
  tone = 'light',
  id,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  tone?: 'light' | 'white' | 'alt' | 'teal' | 'navy' | 'gradient-light';
}) {
  const tones: Record<string, string> = {
    light: 'bg-white',
    white: 'bg-white',
    alt: 'bg-canvas-alt',
    teal: 'bg-brand-100/70',
    navy: 'bg-navy-900 text-brand-100',
    'gradient-light': 'bg-gradient-to-b from-brand-50 via-white to-white',
  };
  return (
    <section id={id} className={cn('py-16 sm:py-20 lg:py-24', tones[tone], className)} {...props} />
  );
}
