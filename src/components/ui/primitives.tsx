import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type {
  EvidenceStrength,
  ClaimVerificationState,
  FitClassification,
  RequirementPriority,
  ReadinessStatus,
  VerificationStatus,
  ApplicationStatus,
} from "@prisma/client";

/** Shared presentational primitives. Business logic stays in services. */

export function Card({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag id={id} className={cn("card p-4 sm:p-5", className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
        {description ? (
          <p className="text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="shrink-0 flex flex-wrap gap-2">{action}</div>
      ) : null}
    </div>
  );
}

const STRENGTH_CLASS: Record<EvidenceStrength, string> = {
  STRONG: "badge-strong",
  PARTIAL: "badge-partial",
  MISSING: "badge-missing",
  UNKNOWN: "badge-unknown",
};

const STRENGTH_TEXT: Record<EvidenceStrength, string> = {
  STRONG: "Strong",
  PARTIAL: "Partial",
  MISSING: "Missing",
  UNKNOWN: "Unknown",
};

export function StrengthBadge({ strength }: { strength: EvidenceStrength }) {
  return (
    <span className={cn("badge", STRENGTH_CLASS[strength])}>
      {STRENGTH_TEXT[strength]}
    </span>
  );
}

const PRIORITY_CLASS: Record<RequirementPriority, string> = {
  CRITICAL: "badge-missing",
  HIGH: "badge-partial",
  MEDIUM: "badge-unknown",
  LOW: "badge-unknown",
};

export function PriorityBadge({ priority }: { priority: RequirementPriority }) {
  return (
    <span className={cn("badge", PRIORITY_CLASS[priority])}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

const CLAIM_CLASS: Record<ClaimVerificationState, string> = {
  SUPPORTED: "badge-strong",
  NEEDS_CONFIRMATION: "badge-partial",
  UNSUPPORTED: "badge-missing",
  CONFLICTED: "badge-missing",
  REJECTED: "badge-missing",
};

const CLAIM_TEXT: Record<ClaimVerificationState, string> = {
  SUPPORTED: "Supported",
  NEEDS_CONFIRMATION: "Needs confirmation",
  UNSUPPORTED: "Unsupported",
  CONFLICTED: "Conflicting",
  REJECTED: "Removed",
};

export function ClaimBadge({ state }: { state: ClaimVerificationState }) {
  return (
    <span className={cn("badge", CLAIM_CLASS[state])}>{CLAIM_TEXT[state]}</span>
  );
}

const VERIFICATION_CLASS: Record<VerificationStatus, string> = {
  VERIFIED: "badge-strong",
  USER_CONFIRMED: "badge-strong",
  UNVERIFIED: "badge-partial",
  CONFLICTED: "badge-missing",
  REJECTED: "badge-unknown",
};

const VERIFICATION_TEXT: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  USER_CONFIRMED: "Confirmed",
  UNVERIFIED: "Unverified",
  CONFLICTED: "Conflicted",
  REJECTED: "Rejected",
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={cn("badge", VERIFICATION_CLASS[status])}>
      {VERIFICATION_TEXT[status]}
    </span>
  );
}

const FIT_CLASS: Record<FitClassification, string> = {
  STRONG_FIT: "badge-strong",
  REASONABLE_FIT: "badge-strong",
  STRETCH: "badge-partial",
  WEAK_FIT: "badge-partial",
  LIKELY_SKIP: "badge-missing",
};

const FIT_TEXT: Record<FitClassification, string> = {
  STRONG_FIT: "Strong fit",
  REASONABLE_FIT: "Reasonable fit",
  STRETCH: "Stretch",
  WEAK_FIT: "Weak fit",
  LIKELY_SKIP: "Likely skip",
};

export function FitBadge({ fit }: { fit: FitClassification }) {
  return <span className={cn("badge", FIT_CLASS[fit])}>{FIT_TEXT[fit]}</span>;
}

const READINESS_CLASS: Record<ReadinessStatus, string> = {
  READY: "badge-strong",
  READY_WITH_WARNINGS: "badge-partial",
  NOT_READY: "badge-missing",
};

const READINESS_TEXT: Record<ReadinessStatus, string> = {
  READY: "Ready",
  READY_WITH_WARNINGS: "Ready with warnings",
  NOT_READY: "Not ready",
};

export function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  return (
    <span className={cn("badge", READINESS_CLASS[status])}>
      {READINESS_TEXT[status]}
    </span>
  );
}

const STATUS_CLASS: Record<ApplicationStatus, string> = {
  SAVED: "badge-unknown",
  ANALYZING: "badge-unknown",
  READY_TO_APPLY: "badge-partial",
  APPLIED: "badge-unknown",
  SCREENING: "badge-partial",
  INTERVIEW: "badge-partial",
  FINAL_INTERVIEW: "badge-partial",
  OFFER: "badge-strong",
  REJECTED: "badge-missing",
  WITHDRAWN: "badge-unknown",
  ARCHIVED: "badge-unknown",
};

const STATUS_TEXT: Record<ApplicationStatus, string> = {
  SAVED: "Saved",
  ANALYZING: "Analyzing",
  READY_TO_APPLY: "Ready to apply",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  FINAL_INTERVIEW: "Final interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ARCHIVED: "Archived",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("badge", STATUS_CLASS[status])}>
      {STATUS_TEXT[status]}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--color-evidence-strong)]"
      : tone === "warning"
        ? "text-[var(--color-evidence-partial)]"
        : tone === "negative"
          ? "text-[var(--color-evidence-missing)]"
          : "text-[var(--text)]";
  return (
    <div className="card-muted px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass)}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{hint}</div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "var(--brand-accent-soft)" }}
      >
        <span
          style={{ color: "var(--brand-accent)" }}
          className="text-lg font-bold"
        >
          A
        </span>
      </div>
      <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--text-muted)]">
        {description}
      </p>
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const map = {
    info: {
      bg: "var(--brand-accent-soft)",
      border: "var(--border-strong)",
      text: "var(--text)",
    },
    success: { bg: "#e6f5ee", border: "#b7e0cb", text: "#125f3f" },
    warning: { bg: "#fdf3e0", border: "#f0dcb0", text: "#7a5409" },
    error: { bg: "#fbeaea", border: "#f0c6c6", text: "#8b2b2b" },
  } as const;
  const s = map[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="rounded-lg px-3 py-2.5 text-sm"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {title ? <div className="font-semibold">{title}</div> : null}
          <div className={title ? "mt-0.5" : ""}>{children}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>{label ?? "Completeness"}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-muted)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Completeness"}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: "var(--brand-accent)" }}
        />
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-1 text-[var(--color-evidence-missing)]">*</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="error-text" id={`${htmlFor}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SaveIndicator({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  if (state === "idle") return null;
  const text =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : "Could not save — retrying";
  return (
    <span
      className="text-xs font-medium"
      style={{
        color:
          state === "error"
            ? "var(--color-evidence-missing)"
            : "var(--text-muted)",
      }}
      role="status"
      aria-live="polite"
    >
      {text}
    </span>
  );
}

export function SaveState({
  state,
}: {
  state: "idle" | "saving" | "saved" | "error";
}) {
  return <SaveIndicator state={state} />;
}
