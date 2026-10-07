import Link from "next/link";
import { PageHero } from "@/components/marketing";
import { PRICING } from "@/domain/entitlements";
import { FreeVsComplete } from "@/components/pricing-compare";

export const metadata = {
  title: "Pricing",
  description:
    "Free Starter to understand and try. Complete Edition to build, execute and repeat.",
};

export default function PricingPage() {
  const [free, complete] = PRICING;
  const paidCheckout = process.env.WHOP_PAID_CHECKOUT_URL;

  return (
    <main id="main" className="mx-auto max-w-[1080px] px-4 py-10">
      <PageHero
        eyebrow="Pricing"
        title="Start free. Upgrade when the system earns its keep."
        lede="The free tier is a real product, not a trial. It is enough to improve one genuine application. The Complete Edition adds the workflows that compound across a whole job search."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card flex flex-col p-5">
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {free.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {free.positioning}
          </p>
          <p className="mt-4 text-3xl font-semibold text-[var(--text)]">
            $0
            <span className="text-base font-normal text-[var(--text-muted)]">
              {" "}
              forever
            </span>
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm text-[var(--text-muted)]">
            {free.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span style={{ color: "var(--brand-accent)" }} aria-hidden>
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-primary mt-5">
            Start free
          </Link>
        </article>

        <article
          className="card flex flex-col p-5"
          style={{ borderColor: "var(--brand-accent)" }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--text)]">
              {complete.name}
            </h2>
            <span
              className="badge"
              style={{
                background: "var(--brand-accent-soft)",
                color: "var(--brand-accent)",
              }}
            >
              Launch price
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {complete.positioning}
          </p>
          <p className="mt-4 text-3xl font-semibold text-[var(--text)]">
            ${complete.launchPriceUsd.toFixed(2)}
            <span className="text-base font-normal text-[var(--text-muted)]">
              {" "}
              launch · ${complete.regularPriceUsd.toFixed(2)} regular
            </span>
          </p>
          <ul className="mt-4 grid max-h-[320px] flex-1 gap-1.5 overflow-y-auto pr-1 text-sm text-[var(--text-muted)]">
            {complete.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span style={{ color: "var(--brand-accent)" }} aria-hidden>
                  ✓
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link href="/signup" className="btn-primary mt-5">
            Create account, then upgrade
          </Link>
          {paidCheckout ? (
            <a
              href={paidCheckout}
              className="btn-secondary mt-3 inline-block"
              rel="noopener noreferrer"
            >
              Buy Complete Edition directly (Whop)
            </a>
          ) : null}
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Entitlements can also be granted manually by an administrator — no
            payment provider required for testing.
          </p>
        </article>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Free vs Complete
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Positioning: <strong>FREE</strong> = Understand + Try.{" "}
          <strong>COMPLETE</strong> = Build + Execute + Repeat.
        </p>
        <FreeVsComplete />
      </section>
    </main>
  );
}
