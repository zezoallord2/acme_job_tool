import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: 'dark' | 'light';
  as?: 'h2' | 'h3';
  size?: 'md' | 'lg';
}

const sizes = {
  md: 'text-[1.75rem] leading-[1.15] sm:text-[2.125rem] lg:text-[2.5rem]',
  lg: 'text-[2rem] leading-[1.1] sm:text-[2.75rem] lg:text-[3.25rem]',
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'dark',
  as: Heading = 'h2',
  size = 'md',
  className,
  children,
  ...props
}: SectionHeadingProps) {
  const centered = align === 'center';
  return (
    <div className={cn('max-w-3xl', centered && 'mx-auto text-center', className)} {...props}>
      {eyebrow ? (
        <p
          className={cn(
            'mb-4 text-[0.72rem] font-bold tracking-[0.18em] uppercase',
            tone === 'light' ? 'text-brand-300' : 'text-brand-700'
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <Heading className={cn(sizes[size], tone === 'light' ? 'text-white' : 'text-navy-900')}>
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            'mt-5 text-base leading-relaxed sm:text-lg',
            centered && 'mx-auto max-w-2xl',
            tone === 'light' ? 'text-brand-100/85' : 'text-ink-soft'
          )}
        >
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}
