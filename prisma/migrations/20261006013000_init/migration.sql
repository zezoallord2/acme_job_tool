-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'USER_CONFIRMED', 'UNVERIFIED', 'CONFLICTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConfidenceCategory" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MetricStatus" AS ENUM ('VERIFIED', 'USER_ESTIMATE', 'UNKNOWN', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('EMPLOYMENT', 'EDUCATION', 'CERTIFICATION', 'PROJECT', 'VOLUNTEER', 'SKILL', 'WORK_SAMPLE', 'DOCUMENT', 'INTERVIEW_RECALL', 'USER_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('SKILL', 'TOOL', 'ACHIEVEMENT', 'RESPONSIBILITY', 'LEADERSHIP', 'METRIC', 'EDUCATION', 'CERTIFICATION', 'EMPLOYMENT', 'DATE', 'SOFT_SKILL');

-- CreateEnum
CREATE TYPE "ClaimVerificationState" AS ENUM ('SUPPORTED', 'NEEDS_CONFIRMATION', 'UNSUPPORTED', 'CONFLICTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProblemType" AS ENUM ('MISSING', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('AUTOMATIC', 'USER_ACTION', 'USER_CONFIRMATION', 'USER_REJECTION', 'USER_EDIT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'ANALYZING', 'READY_TO_APPLY', 'APPLIED', 'SCREENING', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvidenceStrength" AS ENUM ('STRONG', 'PARTIAL', 'MISSING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "FitClassification" AS ENUM ('STRONG_FIT', 'REASONABLE_FIT', 'STRETCH', 'WEAK_FIT', 'LIKELY_SKIP');

-- CreateEnum
CREATE TYPE "EffortLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "OpportunityRecommendation" AS ENUM ('APPLY', 'REVIEW', 'LOW_PRIORITY', 'SKIP');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('READY', 'READY_WITH_WARNINGS', 'NOT_READY');

-- CreateEnum
CREATE TYPE "ReadinessCheckCategory" AS ENUM ('UNSUPPORTED_CLAIMS', 'DATES_CONSISTENT', 'REQUIREMENTS_REVIEWED', 'RESUME_TAILORED', 'CONTACT_COMPLETE', 'METRICS_VERIFIED', 'ANSWERS_CONSISTENT', 'CROSS_DOCUMENT_CONSISTENCY');

-- CreateEnum
CREATE TYPE "CheckSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MASTER_RESUME', 'JOB_SPECIFIC_RESUME', 'COVER_LETTER', 'APPLICATION_ANSWERS', 'LINKEDIN', 'INTERVIEW_BRIEF');

-- CreateEnum
CREATE TYPE "ResumeTemplate" AS ENUM ('STANDARD_PROFESSIONAL', 'FRESH_GRADUATE', 'CAREER_CHANGE');

-- CreateEnum
CREATE TYPE "SectionType" AS ENUM ('CONTACT', 'SUMMARY', 'SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'CERTIFICATIONS', 'VOLUNTEER', 'PROJECTS_EXTRA', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "CoverLetterTone" AS ENUM ('STANDARD', 'CONCISE', 'EMAIL');

-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('MOTIVATION', 'COMPANY', 'SELF_INTRODUCTION', 'EXPERIENCE', 'CHALLENGE', 'SKILL', 'TEAMWORK', 'FAILURE', 'OTHER');

-- CreateEnum
CREATE TYPE "StarCategory" AS ENUM ('ACHIEVEMENT', 'LEADERSHIP', 'FAILURE', 'CONFLICT', 'TEAMWORK', 'PROBLEM_SOLVING', 'DEADLINE', 'CUSTOMER', 'LEARNING', 'INITIATIVE');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('GENERAL', 'BEHAVIORAL', 'ROLE_SPECIFIC', 'TECHNICAL', 'RESUME_BASED', 'GRADUATE', 'CAREER_CHANGE', 'MANAGERIAL');

-- CreateEnum
CREATE TYPE "InterviewFormat" AS ENUM ('PHONE', 'VIDEO', 'ONSITE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "InterviewStage" AS ENUM ('SCREENING', 'FIRST', 'SECOND', 'FINAL', 'PANEL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DefenseVerdict" AS ENUM ('DEFENSIBLE', 'PARTIALLY_SUPPORTED', 'OVERSTATED');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('THANK_YOU', 'FOLLOW_UP', 'SECOND_FOLLOW_UP', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('DRAFT', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntitlementPlan" AS ENUM ('FREE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BillingProviderName" AS ENUM ('WHOP', 'STRIPE', 'MANUAL_ADMIN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AIProviderName" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'OPENROUTER', 'MANUAL');

-- CreateEnum
CREATE TYPE "AIInteractionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'VALIDATION_FAILED', 'FALLBACK_USED', 'MANUAL_AWAITING_INPUT', 'MANUAL_SUBMITTED');

-- CreateEnum
CREATE TYPE "JobInputSource" AS ENUM ('PASTE', 'UPLOAD_PDF', 'UPLOAD_DOCX', 'UPLOAD_TXT', 'MANUAL');

-- CreateEnum
CREATE TYPE "UserGoal" AS ENUM ('IMPROVE_RESUME', 'BETTER_TARGETING', 'INTERVIEW_PREP', 'ORGANIZE_APPLICATIONS', 'FULL_SYSTEM');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('FRESH_GRADUATE', 'ENTRY_LEVEL', 'MID_LEVEL', 'SENIOR', 'EXECUTIVE', 'CAREER_CHANGER');

-- CreateEnum
CREATE TYPE "WorkArrangement" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE', 'NO_PREFERENCE');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('FIRST_NAME', 'EXPERIENCE_LEVEL', 'CURRENT_SITUATION', 'TARGET_ROLE', 'TARGET_INDUSTRY', 'CAREER_CHANGER', 'LOCATION_PREFERENCE', 'WORK_PREFERENCE', 'PRIMARY_GOAL', 'SNAPSHOT_REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SprintTaskKind" AS ENUM ('CAREER_PROFILE', 'ACHIEVEMENT_BANK', 'MASTER_RESUME', 'TARGET_ROLES', 'JOB_ANALYSIS', 'RESUME_TAILORING', 'STAR_STORIES', 'INTERVIEW_PRACTICE', 'APPLICATION_WORKFLOW', 'TRACKING');

-- CreateEnum
CREATE TYPE "SprintTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SprintDayStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INTERVIEW_TOMORROW', 'FOLLOW_UP_DUE', 'DEADLINE_APPROACHING', 'DRAFT_UNFINISHED', 'USER_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'WONTFIX', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ReproductionStatus" AS ENUM ('NOT_ATTEMPTED', 'REPRODUCED', 'FAILED_TO_REPRODUCE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "RootCauseCategory" AS ENUM ('DATA_INTEGRITY', 'VALIDATION', 'AUTHORIZATION', 'AI_OUTPUT', 'EXTERNAL_PROVIDER', 'CONCURRENCY', 'CONFIGURATION', 'UI', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('NEW_EVIDENCE_DISCOVERED', 'INTERVIEW_GAP_DISCOVERED', 'STRONG_STORY_IDENTIFIED', 'REPEATED_REJECTION_PATTERN', 'POSITIVE_RESPONSE_PATTERN', 'MISSING_SKILL_PATTERN', 'USER_FEEDBACK', 'WORKFLOW_FAILURE', 'OUTCOME_RECORDED', 'USER_PREFERENCE_SIGNAL');

-- CreateEnum
CREATE TYPE "LearningSourceType" AS ENUM ('INTERVIEW_REVIEW', 'APPLICATION_OUTCOME', 'EVIDENCE_LEDGER', 'USER_FEEDBACK', 'WORKFLOW', 'ANALYTICS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FactAuthority" AS ENUM ('OBSERVED', 'INFERRED', 'USER_CONFIRMED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "LearningActionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVIEWED', 'IGNORED', 'APPLIED');

-- CreateEnum
CREATE TYPE "FeedbackVote" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateEnum
CREATE TYPE "FeedbackReason" AS ENUM ('TOO_GENERIC', 'INCORRECT', 'UNSUPPORTED_CLAIM', 'TOO_LONG', 'TOO_SHORT', 'WRONG_TONE', 'MISSED_EVIDENCE');

-- CreateEnum
CREATE TYPE "QueueJobState" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'DEAD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QueueJobType" AS ENUM ('DOCUMENT_PARSE', 'EXPORT_PDF', 'EXPORT_CSV', 'ANALYTICS_RECALC', 'AI_WORKFLOW', 'WEBHOOK_PROCESS', 'NOTIFICATION_DISPATCH', 'INTEGRITY_CHECK', 'DEAD_LETTER_REPLAY');

-- CreateEnum
CREATE TYPE "SystemErrorSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SystemErrorCategory" AS ENUM ('DATABASE', 'VALIDATION', 'AUTHORIZATION', 'AUTHENTICATION', 'AI_PROVIDER', 'EXTERNAL_SERVICE', 'FILE_IO', 'QUEUE', 'WEBHOOK', 'EXPORT', 'INTEGRITY', 'CONCURRENCY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'IGNORED', 'MUTED');

-- CreateEnum
CREATE TYPE "CircuitState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateEnum
CREATE TYPE "FlagState" AS ENUM ('OFF', 'INTERNAL', 'PERCENT_ROLLOUT', 'ON');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('ACTIVE', 'CANDIDATE', 'RETIRED');

-- CreateEnum
CREATE TYPE "VersionKind" AS ENUM ('PROMPT', 'WORKFLOW', 'VALIDATOR', 'EVALUATION', 'RANKER');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('IN_PROGRESS', 'RELEASED', 'ROLLED_BACK', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'CONCLUDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImprovementStage" AS ENUM ('OBSERVE', 'MEASURE', 'PROPOSE', 'TEST', 'COMPARE', 'APPROVE', 'DEPLOY', 'MONITOR', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "OutcomeEventType" AS ENUM ('SUBMITTED', 'REPLIED', 'REJECTED', 'SCREENING', 'INTERVIEW', 'OFFER', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RepairEnvironment" AS ENUM ('LOCAL_DEV', 'TEST', 'STAGING');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('PROPOSED', 'APPLIED', 'TEST_PASSED', 'VERIFIED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "HealthState" AS ENUM ('HEALTHY', 'DEGRADED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TaskPriorityAction" AS ENUM ('DO', 'OPTIONAL', 'SKIP');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERRORING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "name" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "suspendedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "aiProvider" "AIProviderName" NOT NULL DEFAULT 'MANUAL',
    "aiModel" TEXT,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "productLearningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyInterviews" BOOLEAN NOT NULL DEFAULT true,
    "notifyFollowUps" BOOLEAN NOT NULL DEFAULT true,
    "notifyDeadlines" BOOLEAN NOT NULL DEFAULT true,
    "notifyDrafts" BOOLEAN NOT NULL DEFAULT false,
    "notifyReminders" BOOLEAN NOT NULL DEFAULT true,
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "autosaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "locationCity" TEXT,
    "locationCountry" TEXT,
    "linkedinUrl" TEXT,
    "portfolioUrl" TEXT,
    "websiteUrl" TEXT,
    "headline" TEXT,
    "summary" TEXT,
    "workArrangement" "WorkArrangement" NOT NULL DEFAULT 'NO_PREFERENCE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" "OnboardingStep" NOT NULL DEFAULT 'FIRST_NAME',
    "firstName" TEXT,
    "experienceLevel" "ExperienceLevel",
    "currentSituation" TEXT,
    "targetRole" TEXT,
    "targetIndustry" TEXT,
    "isCareerChanger" BOOLEAN,
    "locationPreference" TEXT,
    "workArrangement" "WorkArrangement",
    "primaryGoal" "UserGoal",
    "snapshotCreatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "EntitlementPlan" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "BillingProviderName" NOT NULL DEFAULT 'MANUAL_ADMIN',
    "externalEventId" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BillingProviderName" NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "externalEmail" TEXT,
    "rawSummary" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AIProviderName" NOT NULL,
    "label" TEXT,
    "encryptedKey" BYTEA NOT NULL,
    "keyHint" TEXT NOT NULL,
    "keyStatus" "KeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastUsedAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "outcome" TEXT NOT NULL,
    "traceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "limitValue" INTEGER NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerMasterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetRolePrimary" TEXT,
    "targetRoleSecondary" TEXT,
    "targetIndustry" TEXT,
    "yearsExperience" DOUBLE PRECISION,
    "isCareerChanger" BOOLEAN NOT NULL DEFAULT false,
    "careerChangeFrom" TEXT,
    "careerChangeTo" TEXT,
    "currentSituation" TEXT,
    "primaryGoal" "UserGoal",
    "headline" TEXT,
    "professionalSummary" TEXT,
    "openToWork" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" TIMESTAMP(3),
    "completenessPercent" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerMasterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employmentType" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "highlights" TEXT[],
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducationRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "fieldOfStudy" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "grade" TEXT,
    "description" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issuedDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "credentialId" TEXT,
    "url" TEXT,
    "isMandatoryForAnyRole" BOOLEAN NOT NULL DEFAULT false,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "proficiencyLevel" INTEGER,
    "yearsUsed" DOUBLE PRECISION,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT,
    "techStack" TEXT[],
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "url" TEXT,
    "outcomes" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "proficiency" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanguageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "date" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerNarrative" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "originPoint" TEXT,
    "bridgeSteps" TEXT[],
    "destinationRole" TEXT,
    "targetIndustry" TEXT,
    "coreTheme" TEXT,
    "narrativeText" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "evidenceIds" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "isConcise" BOOLEAN NOT NULL DEFAULT false,
    "isFormal" BOOLEAN NOT NULL DEFAULT false,
    "isConversational" BOOLEAN NOT NULL DEFAULT false,
    "isTechnical" BOOLEAN NOT NULL DEFAULT false,
    "isSimple" BOOLEAN NOT NULL DEFAULT false,
    "avgSentenceLength" DOUBLE PRECISION,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "bannedPhrases" TEXT[],
    "preferredPhrases" TEXT[],
    "samples" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceEntityId" TEXT,
    "sourceDescription" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "confidenceCategory" "ConfidenceCategory" NOT NULL DEFAULT 'UNKNOWN',
    "authority" "FactAuthority" NOT NULL DEFAULT 'INFERRED',
    "metricValue" DOUBLE PRECISION,
    "metricUnit" TEXT,
    "metricStatus" "MetricStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "dateRangeStart" TIMESTAMP(3),
    "dateRangeEnd" TIMESTAMP(3),
    "lastConfirmedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employmentId" TEXT,
    "educationId" TEXT,
    "certificationId" TEXT,
    "projectId" TEXT,
    "volunteerId" TEXT,
    "skillId" TEXT,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerFactRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "numericValue" DOUBLE PRECISION,
    "unit" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "confidence" "ConfidenceCategory" NOT NULL DEFAULT 'MEDIUM',
    "metricStatus" "MetricStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "statusLabel" TEXT NOT NULL DEFAULT 'USER_CONFIRMED',
    "evidenceId" TEXT,
    "metadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerFactRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "kind" "EvidenceSourceType" NOT NULL,
    "label" TEXT NOT NULL,
    "locator" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excerpt" TEXT,
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceConflict" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProblemType" NOT NULL,
    "field" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityAId" TEXT,
    "entityBId" TEXT,
    "valueA" TEXT,
    "valueB" TEXT,
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "ResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "evidenceId" TEXT,

    CONSTRAINT "EvidenceConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "challenge" TEXT,
    "actions" TEXT[],
    "result" TEXT,
    "metricValue" DOUBLE PRECISION,
    "metricUnit" TEXT,
    "metricStatus" "MetricStatus" NOT NULL DEFAULT 'UNKNOWN',
    "skills" TEXT[],
    "tools" TEXT[],
    "evidenceIds" TEXT[],
    "verification" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "confidence" "ConfidenceCategory" NOT NULL DEFAULT 'UNKNOWN',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "industry" TEXT,
    "seniority" TEXT,
    "description" TEXT,
    "mustHaveSkills" TEXT[],
    "preferredSkills" TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "location" TEXT,
    "workArrangement" "WorkArrangement",
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "currency" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "inputSource" "JobInputSource" NOT NULL DEFAULT 'PASTE',
    "fileName" TEXT,
    "fileMime" TEXT,
    "fileSizeBytes" INTEGER,
    "rawDescription" TEXT NOT NULL,
    "descriptionHash" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "deadlineAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "recruiterName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetRoleId" TEXT,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,
    "seniority" TEXT,
    "summary" TEXT,
    "mustHaveRequirements" TEXT[],
    "preferredRequirements" TEXT[],
    "responsibilities" TEXT[],
    "hardSkills" TEXT[],
    "softSkills" TEXT[],
    "tools" TEXT[],
    "educationRequirements" TEXT[],
    "certificationRequirements" TEXT[],
    "experienceRequirement" TEXT,
    "repeatedThemes" TEXT[],
    "importantLanguage" TEXT[],
    "dealBreakers" TEXT[],
    "rawResult" JSONB,
    "confidence" "ConfidenceCategory" NOT NULL DEFAULT 'MEDIUM',
    "warnings" TEXT[],
    "workflowId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "provider" "AIProviderName" NOT NULL,
    "model" TEXT NOT NULL,
    "validatorVersion" TEXT NOT NULL,
    "evaluationVersion" TEXT,
    "interactionId" TEXT,
    "manualMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequirement" (
    "id" TEXT NOT NULL,
    "jobAnalysisId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "priority" "RequirementPriority" NOT NULL DEFAULT 'MEDIUM',
    "isMustHave" BOOLEAN NOT NULL DEFAULT false,
    "evidenceBasis" TEXT,
    "notes" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceMatrix" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT,
    "coverageStrong" INTEGER NOT NULL DEFAULT 0,
    "coveragePartial" INTEGER NOT NULL DEFAULT 0,
    "coverageMissing" INTEGER NOT NULL DEFAULT 0,
    "coverageUnknown" INTEGER NOT NULL DEFAULT 0,
    "coveragePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fitClassification" "FitClassification" NOT NULL DEFAULT 'STRETCH',
    "recommendation" "OpportunityRecommendation" NOT NULL DEFAULT 'REVIEW',
    "tailoringEffort" "EffortLevel" NOT NULL DEFAULT 'MEDIUM',
    "explanation" TEXT NOT NULL,
    "criticalGaps" TEXT[],
    "strongSignals" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetRoleId" TEXT,

    CONSTRAINT "EvidenceMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceMatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "strength" "EvidenceStrength" NOT NULL,
    "priority" "RequirementPriority" NOT NULL DEFAULT 'MEDIUM',
    "matchBasis" TEXT NOT NULL,
    "confidence" "ConfidenceCategory" NOT NULL DEFAULT 'MEDIUM',
    "recommendedAction" TEXT NOT NULL,
    "isDealBreaker" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "verificationState" "ClaimVerificationState" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "explanation" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT,
    "interactionId" TEXT,
    "workflowId" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidenceLink" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "ClaimEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "priority" "OpportunityRecommendation" NOT NULL DEFAULT 'REVIEW',
    "userPriority" INTEGER NOT NULL DEFAULT 3,
    "fitClassification" "FitClassification",
    "effort" "EffortLevel",
    "dueAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rejectionStage" TEXT,
    "rejectionReason" TEXT,
    "nextAction" TEXT,
    "nextActionDue" TIMESTAMP(3),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactRole" TEXT,
    "source" TEXT,
    "location" TEXT,
    "salaryNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetRoleId" TEXT,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "reason" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "traceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "label" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "jobAnalysis" JSONB NOT NULL,
    "evidenceMatrix" JSONB NOT NULL,
    "resumeContent" JSONB NOT NULL,
    "coverLetterContent" JSONB,
    "answers" JSONB NOT NULL,
    "evidenceState" JSONB NOT NULL,
    "contactInfo" JSONB,
    "contentHash" TEXT NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "sealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationStatus" "ApplicationStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "ReadinessCheckCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "CheckSeverity" NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT NOT NULL,
    "evidenceRefs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "template" "ResumeTemplate" NOT NULL DEFAULT 'STANDARD_PROFESSIONAL',
    "isMaster" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "jobId" TEXT,
    "applicationId" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "generationId" TEXT,
    "promptVersion" TEXT,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "achievementId" TEXT,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT,
    "label" TEXT,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "generationId" TEXT,
    "promptVersion" TEXT,
    "workflowId" TEXT,
    "interactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeSection" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "type" "SectionType" NOT NULL,
    "title" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeBullet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "achievementId" TEXT,
    "claimId" TEXT,
    "evidenceIds" TEXT[],
    "text" TEXT NOT NULL,
    "originalText" TEXT,
    "defenseVerdict" "DefenseVerdict",
    "defenseNotes" TEXT,
    "state" "ClaimVerificationState" NOT NULL DEFAULT 'NEEDS_CONFIRMATION',
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeBullet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "resumeId" TEXT,
    "achievementIds" TEXT[],
    "tone" "CoverLetterTone" NOT NULL DEFAULT 'STANDARD',
    "body" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "generationId" TEXT,
    "promptVersion" TEXT,
    "workflowId" TEXT,
    "interactionId" TEXT,
    "evidenceIds" TEXT[],
    "warnings" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "question" TEXT NOT NULL,
    "category" "QuestionCategory" NOT NULL DEFAULT 'OTHER',
    "answer" TEXT NOT NULL,
    "isReusable" BOOLEAN NOT NULL DEFAULT false,
    "blockName" TEXT,
    "evidenceIds" TEXT[],
    "warnings" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "generationId" TEXT,
    "promptVersion" TEXT,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "StarCategory" NOT NULL,
    "situation" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "learning" TEXT,
    "evidenceIds" TEXT[],
    "achievementIds" TEXT[],
    "skills" TEXT[],
    "verification" "VerificationStatus" NOT NULL DEFAULT 'USER_CONFIRMED',
    "strength" "EvidenceStrength" NOT NULL DEFAULT 'UNKNOWN',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "jobId" TEXT,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "stage" "InterviewStage" NOT NULL DEFAULT 'UNKNOWN',
    "format" "InterviewFormat" NOT NULL DEFAULT 'UNKNOWN',
    "scheduledAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "interviewerName" TEXT,
    "interviewerRole" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "prepNotes" TEXT,
    "questionsToAsk" TEXT[],
    "checklist" JSONB,
    "risks" TEXT[],
    "gaps" TEXT[],
    "status" "InterviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "postReview" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interviewId" TEXT,
    "mode" "InterviewMode" NOT NULL DEFAULT 'GENERAL',
    "status" "InterviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "targetRole" TEXT,
    "questionLimit" INTEGER NOT NULL DEFAULT 5,
    "questionsAsked" INTEGER NOT NULL DEFAULT 0,
    "overallScore" DOUBLE PRECISION,
    "summary" TEXT,
    "generationId" TEXT,
    "promptVersion" TEXT,
    "workflowId" TEXT,
    "interactionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "category" "InterviewMode" NOT NULL,
    "rationale" TEXT,
    "expectedSignals" TEXT[],
    "followUpAsked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "relevanceScore" DOUBLE PRECISION,
    "specificityScore" DOUBLE PRECISION,
    "evidenceScore" DOUBLE PRECISION,
    "structureScore" DOUBLE PRECISION,
    "clarityScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "unsupportedClaims" TEXT[],
    "followUpQuestion" TEXT,
    "coachNote" TEXT,
    "wasVague" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "interviewId" TEXT,
    "type" "FollowUpType" NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "generationId" TEXT,
    "promptVersion" TEXT,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintDay" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "focus" TEXT,
    "status" "SprintDayStatus" NOT NULL DEFAULT 'PENDING',
    "minutesTarget" INTEGER NOT NULL DEFAULT 45,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SprintDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "sprintDayId" TEXT,
    "kind" "SprintTaskKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SprintTaskStatus" NOT NULL DEFAULT 'PENDING',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInteraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "promptVersion" TEXT,
    "provider" "AIProviderName" NOT NULL DEFAULT 'MANUAL',
    "model" TEXT,
    "validatorVersion" TEXT NOT NULL DEFAULT 'v1',
    "evaluationVersion" TEXT,
    "status" "AIInteractionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCategory" "SystemErrorCategory",
    "errorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "inputSummary" JSONB,
    "outputSummary" JSONB,
    "rawInputHash" TEXT,
    "fallbackProvider" "AIProviderName",
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "traceId" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInteractionFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "vote" "FeedbackVote" NOT NULL,
    "reasons" "FeedbackReason"[],
    "comment" TEXT,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInteractionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersionedArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "VersionKind" NOT NULL,
    "identifier" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'ACTIVE',
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "notes" TEXT,
    "parentId" TEXT,
    "promotedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIEvaluationFixture" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEvaluationFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIEvaluationRun" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "evaluationVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "fixtureCount" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIEvaluationResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "interactionId" TEXT,
    "metrics" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIEvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptCandidate" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PromptStatus" NOT NULL DEFAULT 'CANDIDATE',
    "content" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rationale" TEXT,
    "basedOnVersion" INTEGER,
    "evaluationVersion" TEXT,
    "metrics" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "deployedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "LearningSourceType" NOT NULL,
    "sourceId" TEXT,
    "eventType" "LearningEventType" NOT NULL,
    "observation" TEXT NOT NULL,
    "confidenceCategory" "ConfidenceCategory" NOT NULL DEFAULT 'MEDIUM',
    "supportingData" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedByUser" BOOLEAN NOT NULL DEFAULT false,
    "actionStatus" "LearningActionStatus" NOT NULL DEFAULT 'PENDING',
    "actedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicationId" TEXT,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistilledPattern" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "category" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "evidence" TEXT[],
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "metricName" TEXT,
    "metricValue" DOUBLE PRECISION,
    "confidence" "ConfidenceCategory" NOT NULL DEFAULT 'LOW',
    "sufficiencyNote" TEXT,
    "causalClaim" BOOLEAN NOT NULL DEFAULT false,
    "sourceEventIds" TEXT[],
    "evidenceIds" TEXT[],
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "learningEventId" TEXT,

    CONSTRAINT "DistilledPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learningEventId" TEXT,
    "proposedStatement" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceDescription" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION,
    "metricUnit" TEXT,
    "confidence" "ConfidenceCategory" NOT NULL DEFAULT 'LOW',
    "status" "LearningActionStatus" NOT NULL DEFAULT 'PENDING',
    "appliedEvidenceId" TEXT,
    "actedAt" TIMESTAMP(3),
    "userNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "OutcomeEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferenceSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferenceSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemError" (
    "id" TEXT NOT NULL,
    "traceId" TEXT,
    "severity" "SystemErrorSeverity" NOT NULL,
    "category" "SystemErrorCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "affectedWorkflow" TEXT,
    "service" TEXT NOT NULL DEFAULT 'acme-jobs',
    "sanitizedContext" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "bugReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraceRecord" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "requestId" TEXT,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "method" TEXT,
    "route" TEXT,
    "userId" TEXT,
    "durationMs" INTEGER,
    "result" TEXT NOT NULL,
    "errorCategory" "SystemErrorCategory",
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "p50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p95" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p99" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "QueueJobType" NOT NULL,
    "state" "QueueJobState" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "resultSummary" JSONB,
    "traceId" TEXT,
    "systemErrorId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircuitBreakerState" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "CircuitState" NOT NULL DEFAULT 'CLOSED',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "nextProbeAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CircuitBreakerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderHealth" (
    "id" TEXT NOT NULL,
    "provider" "AIProviderName" NOT NULL,
    "state" "HealthState" NOT NULL DEFAULT 'HEALTHY',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "totalSuccess" INTEGER NOT NULL DEFAULT 0,
    "totalFailure" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheckResult" (
    "id" TEXT NOT NULL,
    "subsystem" TEXT NOT NULL,
    "state" "HealthState" NOT NULL,
    "detail" TEXT NOT NULL,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "state" "FlagState" NOT NULL DEFAULT 'OFF',
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "allowedUserIds" TEXT[],
    "allowedEmails" TEXT[],
    "category" TEXT NOT NULL DEFAULT 'general',
    "securitySensitive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRecord" (
    "id" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "codeRevision" TEXT,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "promptVersions" JSONB NOT NULL,
    "featureFlags" JSONB NOT NULL,
    "notes" TEXT,
    "releasedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "variants" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "results" JSONB,
    "startedAt" TIMESTAMP(3),
    "concludedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfImprovementProposal" (
    "id" TEXT NOT NULL,
    "stage" "ImprovementStage" NOT NULL DEFAULT 'OBSERVE',
    "targetKind" "VersionKind" NOT NULL,
    "targetIdentifier" TEXT NOT NULL,
    "currentVersion" INTEGER,
    "candidateVersion" INTEGER,
    "observation" TEXT NOT NULL,
    "metrics" JSONB,
    "rationale" TEXT NOT NULL,
    "repairEnvironment" "RepairEnvironment",
    "repairStatus" "RepairStatus",
    "repairPatch" TEXT,
    "repairReport" JSONB,
    "repairTraceId" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "deployedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "monitoring" JSONB,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfImprovementProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "diagnosticId" TEXT NOT NULL,
    "userId" TEXT,
    "whatAttempted" TEXT NOT NULL,
    "whatHappened" TEXT NOT NULL,
    "steps" TEXT,
    "screenshotUrl" TEXT,
    "includeDiagnostics" BOOLEAN NOT NULL DEFAULT false,
    "diagnostics" JSONB,
    "status" "BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "severity" "SystemErrorSeverity" NOT NULL DEFAULT 'WARNING',
    "category" "SystemErrorCategory" NOT NULL DEFAULT 'UNKNOWN',
    "traceId" TEXT,
    "reproductionStatus" "ReproductionStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "rootCause" TEXT,
    "rootCauseCategory" "RootCauseCategory",
    "regressionTestPath" TEXT,
    "resolutionNote" TEXT,
    "occurredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" "QueueJobState" NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT,
    "storagePath" TEXT,
    "sizeBytes" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "workItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataIntegrityIssue" (
    "id" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "severity" "SystemErrorSeverity" NOT NULL DEFAULT 'WARNING',
    "detail" TEXT NOT NULL,
    "autoRepairable" BOOLEAN NOT NULL DEFAULT false,
    "repairedAt" TIMESTAMP(3),
    "repairNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataIntegrityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProviderName" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "replayDetected" BOOLEAN NOT NULL DEFAULT false,
    "payloadHash" TEXT NOT NULL,
    "sanitizedPayload" JSONB,
    "status" "QueueJobState" NOT NULL DEFAULT 'QUEUED',
    "entitlementId" TEXT,
    "processedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMetric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "count" INTEGER NOT NULL DEFAULT 0,
    "dimensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_isAdmin_idx" ON "User"("isAdmin");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_userId_idx" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "Entitlement_userId_status_idx" ON "Entitlement"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_source_externalEventId_key" ON "Entitlement"("source", "externalEventId");

-- CreateIndex
CREATE INDEX "UserIntegration_userId_idx" ON "UserIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIntegration_provider_externalUserId_key" ON "UserIntegration"("provider", "externalUserId");

-- CreateIndex
CREATE INDEX "UserApiKey_userId_keyStatus_idx" ON "UserApiKey"("userId", "keyStatus");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_traceId_idx" ON "AuditLog"("traceId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_windowStart_key" ON "RateLimitBucket"("key", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "CareerMasterProfile_userId_key" ON "CareerMasterProfile"("userId");

-- CreateIndex
CREATE INDEX "CareerMasterProfile_userId_idx" ON "CareerMasterProfile"("userId");

-- CreateIndex
CREATE INDEX "EmploymentRecord_userId_startDate_idx" ON "EmploymentRecord"("userId", "startDate");

-- CreateIndex
CREATE INDEX "EducationRecord_userId_idx" ON "EducationRecord"("userId");

-- CreateIndex
CREATE INDEX "Certification_userId_idx" ON "Certification"("userId");

-- CreateIndex
CREATE INDEX "Skill_userId_idx" ON "Skill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_userId_name_key" ON "Skill"("userId", "name");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "VolunteerExperience_userId_idx" ON "VolunteerExperience"("userId");

-- CreateIndex
CREATE INDEX "LanguageRecord_userId_idx" ON "LanguageRecord"("userId");

-- CreateIndex
CREATE INDEX "AwardRecord_userId_idx" ON "AwardRecord"("userId");

-- CreateIndex
CREATE INDEX "CareerNarrative_userId_isActive_idx" ON "CareerNarrative"("userId", "isActive");

-- CreateIndex
CREATE INDEX "VoiceProfile_userId_idx" ON "VoiceProfile"("userId");

-- CreateIndex
CREATE INDEX "Evidence_userId_verificationStatus_idx" ON "Evidence"("userId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Evidence_userId_claimType_idx" ON "Evidence"("userId", "claimType");

-- CreateIndex
CREATE INDEX "Evidence_userId_sourceType_idx" ON "Evidence"("userId", "sourceType");

-- CreateIndex
CREATE INDEX "Evidence_userId_lastConfirmedAt_idx" ON "Evidence"("userId", "lastConfirmedAt");

-- CreateIndex
CREATE INDEX "CareerFactRecord_userId_category_idx" ON "CareerFactRecord"("userId", "category");

-- CreateIndex
CREATE INDEX "EvidenceSource_evidenceId_idx" ON "EvidenceSource"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceConflict_userId_status_idx" ON "EvidenceConflict"("userId", "status");

-- CreateIndex
CREATE INDEX "Achievement_userId_verification_idx" ON "Achievement"("userId", "verification");

-- CreateIndex
CREATE INDEX "Achievement_userId_starred_idx" ON "Achievement"("userId", "starred");

-- CreateIndex
CREATE INDEX "TargetRole_userId_idx" ON "TargetRole"("userId");

-- CreateIndex
CREATE INDEX "JobPosting_userId_createdAt_idx" ON "JobPosting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobPosting_userId_company_idx" ON "JobPosting"("userId", "company");

-- CreateIndex
CREATE INDEX "JobPosting_descriptionHash_idx" ON "JobPosting"("descriptionHash");

-- CreateIndex
CREATE UNIQUE INDEX "JobAnalysis_jobId_key" ON "JobAnalysis"("jobId");

-- CreateIndex
CREATE INDEX "JobAnalysis_userId_idx" ON "JobAnalysis"("userId");

-- CreateIndex
CREATE INDEX "JobRequirement_jobAnalysisId_idx" ON "JobRequirement"("jobAnalysisId");

-- CreateIndex
CREATE INDEX "JobRequirement_normalizedKey_idx" ON "JobRequirement"("normalizedKey");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceMatrix_applicationId_key" ON "EvidenceMatrix"("applicationId");

-- CreateIndex
CREATE INDEX "EvidenceMatrix_userId_fitClassification_idx" ON "EvidenceMatrix"("userId", "fitClassification");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceMatrix_userId_jobId_key" ON "EvidenceMatrix"("userId", "jobId");

-- CreateIndex
CREATE INDEX "EvidenceMatch_userId_strength_idx" ON "EvidenceMatch"("userId", "strength");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceMatch_matrixId_requirementId_key" ON "EvidenceMatch"("matrixId", "requirementId");

-- CreateIndex
CREATE INDEX "GeneratedClaim_userId_verificationState_idx" ON "GeneratedClaim"("userId", "verificationState");

-- CreateIndex
CREATE INDEX "GeneratedClaim_artifactType_artifactId_idx" ON "GeneratedClaim"("artifactType", "artifactId");

-- CreateIndex
CREATE INDEX "GeneratedClaim_generationId_idx" ON "GeneratedClaim"("generationId");

-- CreateIndex
CREATE INDEX "ClaimEvidenceLink_evidenceId_idx" ON "ClaimEvidenceLink"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimEvidenceLink_claimId_evidenceId_key" ON "ClaimEvidenceLink"("claimId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_key" ON "Application"("jobId");

-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- CreateIndex
CREATE INDEX "Application_userId_appliedAt_idx" ON "Application"("userId", "appliedAt");

-- CreateIndex
CREATE INDEX "Application_userId_nextActionDue_idx" ON "Application"("userId", "nextActionDue");

-- CreateIndex
CREATE INDEX "ApplicationStatusEvent_applicationId_createdAt_idx" ON "ApplicationStatusEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationStatusEvent_userId_createdAt_idx" ON "ApplicationStatusEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationArtifact_applicationId_type_isCurrent_idx" ON "ApplicationArtifact"("applicationId", "type", "isCurrent");

-- CreateIndex
CREATE INDEX "ApplicationSnapshot_applicationId_idx" ON "ApplicationSnapshot"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_createdAt_idx" ON "ApplicationNote"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReadinessCheck_applicationId_idx" ON "ReadinessCheck"("applicationId");

-- CreateIndex
CREATE INDEX "Resume_userId_isMaster_idx" ON "Resume"("userId", "isMaster");

-- CreateIndex
CREATE INDEX "Resume_userId_jobId_idx" ON "Resume"("userId", "jobId");

-- CreateIndex
CREATE INDEX "ResumeVersion_resumeId_isSent_idx" ON "ResumeVersion"("resumeId", "isSent");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeVersion_resumeId_version_key" ON "ResumeVersion"("resumeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeSection_resumeId_type_key" ON "ResumeSection"("resumeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ResumeBullet_claimId_key" ON "ResumeBullet"("claimId");

-- CreateIndex
CREATE INDEX "ResumeBullet_userId_state_idx" ON "ResumeBullet"("userId", "state");

-- CreateIndex
CREATE INDEX "ResumeBullet_resumeId_idx" ON "ResumeBullet"("resumeId");

-- CreateIndex
CREATE INDEX "CoverLetter_userId_createdAt_idx" ON "CoverLetter"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationAnswer_userId_category_idx" ON "ApplicationAnswer"("userId", "category");

-- CreateIndex
CREATE INDEX "ApplicationAnswer_applicationId_idx" ON "ApplicationAnswer"("applicationId");

-- CreateIndex
CREATE INDEX "StarStory_userId_category_idx" ON "StarStory"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_jobId_key" ON "Interview"("jobId");

-- CreateIndex
CREATE INDEX "Interview_userId_scheduledAt_idx" ON "Interview"("userId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_interviewId_key" ON "InterviewSession"("interviewId");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "InterviewSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_sessionId_orderIndex_key" ON "InterviewQuestion"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "InterviewAnswer_sessionId_idx" ON "InterviewAnswer"("sessionId");

-- CreateIndex
CREATE INDEX "InterviewAnswer_userId_idx" ON "InterviewAnswer"("userId");

-- CreateIndex
CREATE INDEX "FollowUp_userId_status_scheduledFor_idx" ON "FollowUp"("userId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Sprint_userId_status_idx" ON "Sprint"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SprintDay_sprintId_dayNumber_key" ON "SprintDay"("sprintId", "dayNumber");

-- CreateIndex
CREATE INDEX "SprintTask_userId_status_idx" ON "SprintTask"("userId", "status");

-- CreateIndex
CREATE INDEX "AIInteraction_userId_workflowId_createdAt_idx" ON "AIInteraction"("userId", "workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "AIInteraction_status_idx" ON "AIInteraction"("status");

-- CreateIndex
CREATE INDEX "AIInteractionFeedback_interactionId_idx" ON "AIInteractionFeedback"("interactionId");

-- CreateIndex
CREATE INDEX "AIInteractionFeedback_userId_createdAt_idx" ON "AIInteractionFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VersionedArtifact_kind_identifier_status_idx" ON "VersionedArtifact"("kind", "identifier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VersionedArtifact_kind_identifier_version_key" ON "VersionedArtifact"("kind", "identifier", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AIEvaluationFixture_slug_key" ON "AIEvaluationFixture"("slug");

-- CreateIndex
CREATE INDEX "AIEvaluationResult_runId_idx" ON "AIEvaluationResult"("runId");

-- CreateIndex
CREATE INDEX "PromptCandidate_identifier_status_idx" ON "PromptCandidate"("identifier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromptCandidate_identifier_version_key" ON "PromptCandidate"("identifier", "version");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_eventType_idx" ON "LearningEvent"("userId", "eventType");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_createdAt_idx" ON "LearningEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvent_userId_dedupeKey_key" ON "LearningEvent"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "DistilledPattern_userId_category_idx" ON "DistilledPattern"("userId", "category");

-- CreateIndex
CREATE INDEX "EvidenceProposal_userId_status_idx" ON "EvidenceProposal"("userId", "status");

-- CreateIndex
CREATE INDEX "ApplicationOutcome_userId_occurredAt_idx" ON "ApplicationOutcome"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "ApplicationOutcome_applicationId_idx" ON "ApplicationOutcome"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferenceSignal_userId_key_value_key" ON "UserPreferenceSignal"("userId", "key", "value");

-- CreateIndex
CREATE INDEX "Notification_userId_status_dueAt_idx" ON "Notification"("userId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "SystemError_bugReportId_key" ON "SystemError"("bugReportId");

-- CreateIndex
CREATE INDEX "SystemError_severity_resolutionStatus_idx" ON "SystemError"("severity", "resolutionStatus");

-- CreateIndex
CREATE INDEX "SystemError_traceId_idx" ON "SystemError"("traceId");

-- CreateIndex
CREATE INDEX "SystemError_createdAt_idx" ON "SystemError"("createdAt");

-- CreateIndex
CREATE INDEX "SystemError_category_idx" ON "SystemError"("category");

-- CreateIndex
CREATE INDEX "TraceRecord_traceId_idx" ON "TraceRecord"("traceId");

-- CreateIndex
CREATE INDEX "TraceRecord_operation_startedAt_idx" ON "TraceRecord"("operation", "startedAt");

-- CreateIndex
CREATE INDEX "TraceRecord_createdAt_idx" ON "TraceRecord"("createdAt");

-- CreateIndex
CREATE INDEX "PerformanceMetric_name_windowStart_idx" ON "PerformanceMetric"("name", "windowStart");

-- CreateIndex
CREATE INDEX "WorkQueueItem_state_nextRunAt_idx" ON "WorkQueueItem"("state", "nextRunAt");

-- CreateIndex
CREATE INDEX "WorkQueueItem_userId_idx" ON "WorkQueueItem"("userId");

-- CreateIndex
CREATE INDEX "WorkQueueItem_createdAt_idx" ON "WorkQueueItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkQueueItem_type_idempotencyKey_key" ON "WorkQueueItem"("type", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON "IdempotencyKey"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "CircuitBreakerState_name_key" ON "CircuitBreakerState"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderHealth_provider_key" ON "ProviderHealth"("provider");

-- CreateIndex
CREATE INDEX "HealthCheckResult_subsystem_checkedAt_idx" ON "HealthCheckResult"("subsystem", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_state_idx" ON "FeatureFlag"("state");

-- CreateIndex
CREATE INDEX "ReleaseRecord_status_createdAt_idx" ON "ReleaseRecord"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_key_key" ON "Experiment"("key");

-- CreateIndex
CREATE INDEX "SelfImprovementProposal_stage_idx" ON "SelfImprovementProposal"("stage");

-- CreateIndex
CREATE INDEX "SelfImprovementProposal_targetIdentifier_idx" ON "SelfImprovementProposal"("targetIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "BugReport_diagnosticId_key" ON "BugReport"("diagnosticId");

-- CreateIndex
CREATE INDEX "BugReport_status_createdAt_idx" ON "BugReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BugReport_userId_idx" ON "BugReport"("userId");

-- CreateIndex
CREATE INDEX "DataExportRequest_userId_createdAt_idx" ON "DataExportRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DataIntegrityIssue_checkName_createdAt_idx" ON "DataIntegrityIssue"("checkName", "createdAt");

-- CreateIndex
CREATE INDEX "DataIntegrityIssue_autoRepairable_idx" ON "DataIntegrityIssue"("autoRepairable");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "ProductMetric_name_bucket_idx" ON "ProductMetric"("name", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetric_name_bucket_key" ON "ProductMetric"("name", "bucket");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIntegration" ADD CONSTRAINT "UserIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLimitBucket" ADD CONSTRAINT "RateLimitBucket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerMasterProfile" ADD CONSTRAINT "CareerMasterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EducationRecord" ADD CONSTRAINT "EducationRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerExperience" ADD CONSTRAINT "VolunteerExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageRecord" ADD CONSTRAINT "LanguageRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardRecord" ADD CONSTRAINT "AwardRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerNarrative" ADD CONSTRAINT "CareerNarrative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceProfile" ADD CONSTRAINT "VoiceProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "EmploymentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_educationId_fkey" FOREIGN KEY ("educationId") REFERENCES "EducationRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "VolunteerExperience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerFactRecord" ADD CONSTRAINT "CareerFactRecord_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerFactRecord" ADD CONSTRAINT "CareerFactRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "EvidenceSource_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceConflict" ADD CONSTRAINT "EvidenceConflict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceConflict" ADD CONSTRAINT "EvidenceConflict_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetRole" ADD CONSTRAINT "TargetRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "TargetRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequirement" ADD CONSTRAINT "JobRequirement_jobAnalysisId_fkey" FOREIGN KEY ("jobAnalysisId") REFERENCES "JobAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatrix" ADD CONSTRAINT "EvidenceMatrix_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatrix" ADD CONSTRAINT "EvidenceMatrix_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatrix" ADD CONSTRAINT "EvidenceMatrix_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "TargetRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatrix" ADD CONSTRAINT "EvidenceMatrix_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatch" ADD CONSTRAINT "EvidenceMatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatch" ADD CONSTRAINT "EvidenceMatch_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "EvidenceMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatch" ADD CONSTRAINT "EvidenceMatch_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "JobRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceMatch" ADD CONSTRAINT "EvidenceMatch_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedClaim" ADD CONSTRAINT "GeneratedClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidenceLink" ADD CONSTRAINT "ClaimEvidenceLink_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "GeneratedClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidenceLink" ADD CONSTRAINT "ClaimEvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_targetRoleId_fkey" FOREIGN KEY ("targetRoleId") REFERENCES "TargetRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationArtifact" ADD CONSTRAINT "ApplicationArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationArtifact" ADD CONSTRAINT "ApplicationArtifact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSnapshot" ADD CONSTRAINT "ApplicationSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSnapshot" ADD CONSTRAINT "ApplicationSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessCheck" ADD CONSTRAINT "ReadinessCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessCheck" ADD CONSTRAINT "ReadinessCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeSection" ADD CONSTRAINT "ResumeSection_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeBullet" ADD CONSTRAINT "ResumeBullet_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeBullet" ADD CONSTRAINT "ResumeBullet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeBullet" ADD CONSTRAINT "ResumeBullet_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeBullet" ADD CONSTRAINT "ResumeBullet_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "GeneratedClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationAnswer" ADD CONSTRAINT "ApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarStory" ADD CONSTRAINT "StarStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewAnswer" ADD CONSTRAINT "InterviewAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintDay" ADD CONSTRAINT "SprintDay_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintTask" ADD CONSTRAINT "SprintTask_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintTask" ADD CONSTRAINT "SprintTask_sprintDayId_fkey" FOREIGN KEY ("sprintDayId") REFERENCES "SprintDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteractionFeedback" ADD CONSTRAINT "AIInteractionFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInteractionFeedback" ADD CONSTRAINT "AIInteractionFeedback_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AIInteraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VersionedArtifact" ADD CONSTRAINT "VersionedArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIEvaluationResult" ADD CONSTRAINT "AIEvaluationResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AIEvaluationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIEvaluationResult" ADD CONSTRAINT "AIEvaluationResult_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "AIInteraction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistilledPattern" ADD CONSTRAINT "DistilledPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistilledPattern" ADD CONSTRAINT "DistilledPattern_learningEventId_fkey" FOREIGN KEY ("learningEventId") REFERENCES "LearningEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceProposal" ADD CONSTRAINT "EvidenceProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceProposal" ADD CONSTRAINT "EvidenceProposal_learningEventId_fkey" FOREIGN KEY ("learningEventId") REFERENCES "LearningEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationOutcome" ADD CONSTRAINT "ApplicationOutcome_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceSignal" ADD CONSTRAINT "UserPreferenceSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemError" ADD CONSTRAINT "SystemError_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemError" ADD CONSTRAINT "SystemError_bugReportId_fkey" FOREIGN KEY ("bugReportId") REFERENCES "BugReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraceRecord" ADD CONSTRAINT "TraceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkQueueItem" ADD CONSTRAINT "WorkQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkQueueItem" ADD CONSTRAINT "WorkQueueItem_systemErrorId_fkey" FOREIGN KEY ("systemErrorId") REFERENCES "SystemError"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
