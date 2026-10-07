import {
  FREE_CAPABILITIES,
  COMPLETE_CAPABILITIES,
} from "@/domain/entitlements";

const LABELS: Record<string, string> = {
  CAREER_SNAPSHOT: "Career Snapshot",
  CAREER_MASTER_PROFILE: "Full Career Master Profile",
  EVIDENCE_LEDGER_BASIC: "Career evidence",
  EVIDENCE_LEDGER_FULL: "Full Evidence Ledger + Achievement Mining",
  ACHIEVEMENT_MINING: "Achievement Mining",
  TARGET_ROLE_BLUEPRINT: "Target Role Blueprint",
  JOB_ANALYZER_BASIC: "Basic Job Description Analyzer",
  JOB_ANALYZER_DEEP: "Deep Job Analyzer",
  EVIDENCE_MATRIX_BASIC: "Basic Evidence Matrix",
  EVIDENCE_MATRIX_FULL: "Full Evidence Matrix + Apply/Review/Skip",
  FIT_RECOMMENDATION: "Apply / Review / Skip recommendation",
  EFFORT_VS_OPPORTUNITY: "Effort vs Opportunity",
  RESUME_QUICK_CHECK: "Resume Quick Check",
  MASTER_RESUME: "Master Resume",
  RESUME_VERSIONS: "Multiple resume versions + lineage",
  RESUME_TAILORING_BASIC: "Basic resume tailoring",
  RESUME_TAILORING_ADVANCED: "Advanced tailoring",
  RESUME_BULLET_BUILDER: "Resume Bullet Builder",
  CLAIM_INSPECTOR: "Claim Inspector",
  CONSISTENCY_ENGINE: "Cross-Document Consistency Engine",
  READINESS_GATE: "Application Readiness Gate",
  COVER_LETTER_BUILDER: "Cover Letter Builder",
  LINKEDIN_OPTIMIZER: "LinkedIn Optimizer",
  APPLICATION_QUESTION_BUILDER: "Application Question Builder",
  VOICE_PROFILE: "Personal Voice Profile",
  CAREER_NARRATIVE: "Career Narrative Engine",
  STAR_BANK_BASIC: "One STAR story",
  STAR_BANK_FULL: "Full STAR Story Bank",
  MOCK_INTERVIEW_BASIC: "Five-question mock interview",
  MOCK_INTERVIEW_ADVANCED: "Adaptive mock interviews",
  DEFEND_THIS_CLAIM: "Defend This Claim",
  INTERVIEW_COMMAND_CENTER: "Interview Command Center",
  POST_INTERVIEW_REVIEW: "Post-Interview Review",
  FOLLOW_UP_BUILDER: "Follow-Up Builder",
  APPLICATION_CAPSULE: "Application Capsule",
  IMMUTABLE_SENT_VERSIONS: "Immutable Sent Versions",
  APPLICATION_TRACKER: "Application Tracker",
  ANALYTICS: "Analytics",
  CAREER_LEARNING: "Career Learning Review",
  DAILY_PRIORITY_ENGINE: "Daily Priority Engine",
  ASK_ACME: "Ask Acme",
  SPRINT_14_DAY: "14-Day Job Search Sprint",
  COMPLETE_BOOK: "Complete Edition PDF access",
  FREE_GUIDE: "Free Starter Guide access",
};

export function FreeVsComplete() {
  const paidOnly = COMPLETE_CAPABILITIES.filter(
    (c) => !FREE_CAPABILITIES.includes(c),
  );
  return (
    <div className="mt-4 space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Included in Starter (free)
        </h3>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {FREE_CAPABILITIES.map((c) => (
            <li key={c} className="text-sm text-[var(--text-muted)]">
              <span style={{ color: "var(--brand-accent)" }} aria-hidden>
                ✓{" "}
              </span>
              {LABELS[c] ?? c}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Complete Edition adds
        </h3>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {paidOnly.map((c) => (
            <li key={c} className="text-sm text-[var(--text-muted)]">
              <span style={{ color: "var(--brand-accent)" }} aria-hidden>
                ✓{" "}
              </span>
              {LABELS[c] ?? c}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
