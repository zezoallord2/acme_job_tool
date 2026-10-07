import { ArrowRight, Check, CircleCheck, FileSearch, Quote } from 'lucide-react';
import { brandPromise } from '@/content/marketing';

/**
 * Layered evidence panel for the hero.
 *
 * It is static server-rendered markup (no client JS), styled like a real piece of
 * product UI so the hero communicates the method before a single scroll. It is
 * decorative context for the headline, never the thing carrying the message, so
 * the mobile version is deliberately simplified.
 */
export function EvidencePanel() {
  return (
    <div className="relative mx-auto w-full max-w-[30rem] lg:max-w-none" aria-hidden="true">
      <div
        className="bg-brand-500/10 absolute -inset-6 -z-10 rounded-[2.5rem] blur-3xl"
        data-hidden="mobile"
      />

      <div className="relative space-y-3.5">
        {/* Card 1 — requirement matched to real evidence */}
        <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              Job requirement
            </p>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.75rem] font-semibold text-white/80">
              Step 2–3
            </span>
          </div>
          <p className="mt-2.5 text-[0.92rem] leading-snug font-semibold text-white">
            “Own onboarding for mid-market customers and reduce time-to-value.”
          </p>
          <div className="bg-navy-950/50 mt-4 flex items-start gap-2.5 rounded-xl p-3">
            <CircleCheck aria-hidden="true" className="text-brand-400 mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-brand-100/85 text-[0.82rem] leading-snug">
              Matched to your evidence:{' '}
              <span className="font-semibold text-white">
                “Ran onboarding for 12 mid-market accounts in my last role.”
              </span>
            </p>
          </div>
        </div>

        {/* Card 2 — the claim check */}
        <div className="ml-auto w-[92%] rounded-2xl border border-white/15 bg-white/[0.07] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] backdrop-blur-md sm:w-[85%]">
          <div className="flex items-center gap-2">
            <FileSearch aria-hidden="true" className="text-brand-300 h-4 w-4" />
            <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              Claim check
            </p>
          </div>
          <ul className="mt-3.5 space-y-2.5">
            {[
              { label: 'Improved onboarding completion by 30%', ok: true },
              { label: 'Managed a team of 8', ok: false },
            ].map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    item.ok ? 'bg-brand-500/25 text-brand-300' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {item.ok ? (
                    <Check aria-hidden="true" className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : (
                    <span className="block h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={`text-[0.82rem] leading-snug ${
                    item.ok ? 'text-brand-100/85' : 'text-white/60 line-through decoration-white/30'
                  }`}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-brand-200/80 mt-3.5 border-t border-white/10 pt-3 text-[0.72rem] leading-snug">
            Unverified claims get flagged, not quietly invented.
          </p>
        </div>

        {/* Card 3 — STAR story */}
        <div className="w-[88%] rounded-2xl border border-white/15 bg-white/[0.07] p-5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.9)] backdrop-blur-md sm:w-[78%]">
          <div className="flex items-center gap-2">
            <Quote aria-hidden="true" className="text-brand-300 h-4 w-4" />
            <p className="text-brand-300 text-[0.75rem] font-bold tracking-[0.14em] uppercase">
              STAR story saved
            </p>
          </div>
          <p className="text-brand-100/85 mt-3 text-[0.84rem] leading-relaxed">
            <span className="font-semibold text-white">S</span> — support requests spiked after a
            product change. <span className="font-semibold text-white">T</span> — I owned the
            first-response queue. <span className="font-semibold text-white">A</span> — I wrote
            triage rules the team still uses. <span className="font-semibold text-white">R</span> —
            response time fell measurably.
          </p>
          <p className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] font-semibold text-white/70">
            Ready to defend in an interview
            <ArrowRight aria-hidden="true" className="text-brand-400 h-3 w-3" />
          </p>
        </div>
      </div>

      <p className="text-brand-100/50 mt-4 text-center text-[0.75rem] font-medium tracking-[0.02em] sm:text-left">
        {brandPromise}
      </p>
    </div>
  );
}

export default EvidencePanel;
