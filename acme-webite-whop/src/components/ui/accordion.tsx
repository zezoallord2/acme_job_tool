import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      'group border-line data-[state=open]:border-brand-300 data-[state=open]:shadow-soft overflow-hidden rounded-2xl border bg-white transition-colors duration-200',
      className
    )}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'text-navy-900 hover:text-brand-800 [&[data-state=open]>svg]:text-brand-600 flex flex-1 items-start justify-between gap-4 px-5 py-4 text-left text-[0.98rem] font-semibold transition-colors duration-200 sm:px-6 sm:py-5 sm:text-[1.05rem] [&[data-state=open]>svg]:rotate-45',
        className
      )}
      {...props}
    >
      {children}
      <Plus
        aria-hidden="true"
        className="text-ink-muted mt-0.5 h-5 w-5 shrink-0 rotate-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="data-[state=open]:animate-fade-rise overflow-hidden data-[state=closed]:animate-none"
    {...props}
  >
    <div
      className={cn(
        'text-ink-soft px-5 pb-5 text-[0.95rem] leading-relaxed sm:px-6 sm:pb-6 sm:text-base',
        className
      )}
    >
      {children}
    </div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
