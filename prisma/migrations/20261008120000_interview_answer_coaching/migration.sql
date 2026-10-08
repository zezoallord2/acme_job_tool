-- Mock interview coaching: per-answer strength, improvement and a stronger
-- answer built from the user's own evidence.
ALTER TABLE "InterviewAnswer" ADD COLUMN "strength" TEXT;
ALTER TABLE "InterviewAnswer" ADD COLUMN "improvement" TEXT;
ALTER TABLE "InterviewAnswer" ADD COLUMN "suggestedAnswer" TEXT;
