import { ArrowUpRight, Boxes, Sparkles } from 'lucide-react';
import { Container, Section } from '@/components/ui/container';
import { Badge } from '@/components/ui/badge';
import { LiquidHero } from '@/components/hero/liquid-hero';
import { WaitlistForm } from '@/components/waitlist-form';
import { upcomingApp } from '@/content/marketing';
import { waitlistConfig } from '@/lib/config';

export function ComingSoon() {
  return (
    <Section tone="navy" className="relative overflow-hidden" aria-labelledby="app-heading">
      <LiquidHero variant="band" />
      <div aria-hidden="true" className="bg-navy-950/62 absolute inset-0" />
      <div aria-hidden="true" className="grain-overlay absolute inset-0 opacity-20" />

      <Container className="relative">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div>
            <Badge variant="light" size="md">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {upcomingApp.badge}
            </Badge>

            <h2
              id="app-heading"
              className="mt-5 text-[1.85rem] leading-[1.15] font-bold tracking-[-0.025em] text-white sm:text-[2.5rem]"
            >
              {upcomingApp.headline}
            </h2>

            <p className="text-brand-100/85 mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              {upcomingApp.lede}
            </p>

            <h3 className="text-brand-300 mt-9 text-[0.75rem] font-bold tracking-[0.16em] uppercase">
              What we are building
            </h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {upcomingApp.capabilities.map((capability) => (
                <li
                  key={capability}
                  className="text-brand-100/85 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[0.82rem] font-semibold"
                >
                  {capability}
                </li>
              ))}
            </ul>

            <div id="early-access" className="mt-10 scroll-mt-28">
              <h3 className="text-lg font-bold text-white">Join the early access list</h3>
              <p className="text-brand-100/75 mt-2 max-w-lg text-[0.95rem] leading-relaxed">
                Get an email when early access opens. We are not publishing a launch date yet, and
                we will not invent one to create urgency.
              </p>
              <WaitlistForm
                enabled={waitlistConfig.enabled}
                source="coming-soon-section"
                className="mt-5 max-w-xl"
              />
            </div>
          </div>

          <div>
            <p className="text-brand-300 flex items-center gap-2 text-[0.75rem] font-bold tracking-[0.16em] uppercase">
              <Boxes aria-hidden="true" className="h-4 w-4" />
              Concept modules
            </p>
            <ul className="mt-5 grid gap-3.5 sm:grid-cols-2">
              {upcomingApp.cards.map((card) => (
                <li
                  key={card.title}
                  className="hover:border-brand-400/45 rounded-[--radius-card] border border-white/12 bg-white/[0.06] p-5 backdrop-blur-sm transition-[transform,border-color] duration-300 hover:-translate-y-1"
                >
                  <h4 className="text-[0.95rem] font-bold text-white">{card.title}</h4>
                  <p className="text-brand-100/75 mt-2 text-[0.85rem] leading-relaxed">
                    {card.description}
                  </p>
                </li>
              ))}
            </ul>

            <p className="text-brand-100/55 mt-6 flex items-start gap-2 text-[0.78rem] leading-relaxed">
              <ArrowUpRight aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              These are the capabilities we are designing. The app is not available today, and this
              page is not a sign-up for an existing product.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

export default ComingSoon;
