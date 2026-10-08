import {
  FREE_CAPABILITIES,
  COMPLETE_CAPABILITIES,
} from "@/domain/entitlements";

const LABELS: Record<string, string> = {
  CAREER_SNAPSHOT: "Quick Profile",
  CAREER_MASTER_PROFILE: "Full My Profile",
  EVIDENCE_LEDGER_BASIC: "Career evidence",
  EVIDENCE_LEDGER_FULL: "Full My Experience + Find My Wins",
  ACHIEVEMENT_MINING: "Find My Wins",
  TARGET_ROLE_BLUEPRINT: "Job Goals",
  JOB_ANALYZER_BASIC: "Basic Job Check",
  JOB_ANALYZER_DEEP: "Deep Job Analyzer",
  EVIDENCE_MATRIX_BASIC: "Basic Match Breakdown",
  EVIDENCE_MATRIX_FULL: "Full Match Breakdown + Apply/Review/Skip",
  FIT_RECOMMENDATION: "Should I Apply? recommendation",
  EFFORT_VS_OPPORTUNITY: "Best Jobs",
  RESUME_QUICK_CHECK: "Resume Quick Check",
  MASTER_RESUME: "My Resume",
  RESUME_VERSIONS: "Multiple resume versions + lineage",
  RESUME_TAILORING_BASIC: "Basic resume tailoring",
  RESUME_TAILORING_ADVANCED: "Advanced tailoring",
  RESUME_BULLET_BUILDER: "Improve Bullet",
  CLAIM_INSPECTOR: "Truth Check",
  CONSISTENCY_ENGINE: "Consistency Check",
  READINESS_GATE: "Ready to Apply?",
  COVER_LETTER_BUILDER: "Cover Letter",
  LINKEDIN_OPTIMIZER: "LinkedIn",
  APPLICATION_QUESTION_BUILDER: "Application Answers",
  VOICE_PROFILE: "Writing Style",
  CAREER_NARRATIVE: "Career Story",
  STAR_BANK_BASIC: "One STAR story",
  STAR_BANK_FULL: "Full Interview Stories",
  MOCK_INTERVIEW_BASIC: "AI mock interviews",
  MOCK_INTERVIEW_ADVANCED: "Adaptive mock interviews",
  DEFEND_THIS_CLAIM: "Can I Defend This?",
  INTERVIEW_COMMAND_CENTER: "Interview Prep",
  POST_INTERVIEW_REVIEW: "Interview Review",
  FOLLOW_UP_BUILDER: "Follow-Up Message",
  APPLICATION_CAPSULE: "Application Details",
  IMMUTABLE_SENT_VERSIONS: "Immutable Sent Versions",
  APPLICATION_TRACKER: "My Applications",
  ANALYTICS: "Analytics",
  CAREER_LEARNING: "Career Learning Review",
  DAILY_PRIORITY_ENGINE: "Today's Tasks",
  ASK_ACME: "Acme Assistant",
  SPRINT_14_DAY: "14-Day Plan",
  COMPLETE_BOOK: "Complete Edition PDF access",
  FREE_GUIDE: "Free Starter Guide access",
};

export function FreeVsComplete() {
  const paidOnly = COMPLETE_CAPABILITIES.filter(
    (c) => c !== "ASK_ACME" && !FREE_CAPABILITIES.includes(c),
  );
  return (
    <div className="mt-4 space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-[var(--text)]">
          Included in Starter (free)
        </h3>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {FREE_CAPABILITIES.filter((c) => c !== "ASK_ACME").map((c) => (
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
