'use client';

import * as React from 'react';
import { CircleCheck, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { joinWaitlist } from '@/lib/waitlist-fn';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'submitting' | 'success' | 'error';

interface WaitlistFormProps {
  /** Disabled renders a clean â€œnot open yetâ€ message instead of a dead form. */
  enabled: boolean;
  source?: string;
  className?: string;
}

/**
 * Early-access signup form.
 *
 * Client-side validation mirrors the server, but the server is the authority â€”
 * the form never reports success on its own.
 */
export function WaitlistForm({ enabled, source = 'app-page', className }: WaitlistFormProps) {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<Status>('idle');
  const [message, setMessage] = React.useState<string>('');

  const inputId = React.useId();
  const messageId = React.useId();

  if (!enabled) {
    return (
      <div
        className={cn(
          'border-line text-ink-soft rounded-2xl border bg-white p-5 text-[0.92rem]',
          className
        )}
      >
        <p className="text-navy-900 font-semibold">The early-access list is not open yet.</p>
        <p className="mt-1.5">
          The Acme Jobs app is still in development. In the meantime, the free Starter Guide is the
          fastest way to use the method today.
        </p>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'submitting') return;

    const trimmed = email.trim();
    // Deliberately simple client check; the API validates properly.
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(trimmed)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setStatus('submitting');
    setMessage('');

    try {
      // Server-side RPC: validation and the webhook URL stay on the server.
      const data = await joinWaitlist({
        data: {
          email: trimmed,
          source,
          referrer: typeof document === 'undefined' ? null : document.referrer || null,
        },
      });

      if (!data.ok) {
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setMessage(
        data.duplicate === true
          ? 'You are already on the list â€” we will be in touch.'
          : 'You are on the list. We will email you when early access opens.'
      );
      track('waitlist_submitted', { source });
    } catch {
      setStatus('error');
      setMessage('We could not reach the server. Please check your connection and try again.');
    }
  }

  if (status === 'success') {
    return (
      <div
        className={cn(
          'border-brand-300 bg-brand-100 flex items-start gap-3 rounded-2xl border p-5',
          className
        )}
        role="status"
      >
        <CircleCheck aria-hidden="true" className="text-brand-700 mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-brand-900 text-[0.95rem] leading-relaxed font-semibold">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn('w-full', className)}>
      <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-white">
        Email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Mail
            aria-hidden="true"
            className="text-brand-200/70 pointer-events-none absolute top-1/2 left-4 h-[1.1rem] w-[1.1rem] -translate-y-1/2"
          />
          <input
            id={inputId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status === 'error') setStatus('idle');
            }}
            aria-invalid={status === 'error'}
            aria-describedby={message ? messageId : undefined}
            className="placeholder:text-brand-100/45 focus:border-brand-400 h-13 w-full rounded-full border border-white/20 bg-white/10 pr-4 pl-11 text-base text-white focus:bg-white/15 focus:outline-none"
          />
        </div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={status === 'submitting'}
          className="w-full shrink-0 justify-center sm:w-auto"
        >
          {status === 'submitting' ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Joiningâ€¦
            </>
          ) : (
            'Join the early access list'
          )}
        </Button>
      </div>
      <p
        id={messageId}
        role={status === 'error' ? 'alert' : undefined}
        className={cn(
          'mt-2.5 text-sm',
          status === 'error' ? 'font-medium text-rose-300' : 'text-brand-100/65'
        )}
      >
        {message || 'No spam, no reselling of your details. Product updates only.'}
      </p>
    </form>
  );
}

export default WaitlistForm;
