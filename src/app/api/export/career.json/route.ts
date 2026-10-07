import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { asAppError, userFacingMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Full data export. The user id always comes from the server-side session, never
 * from a parameter, so one user can never export another's data.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const userId = user.id;

    const [
      profile,
      settings,
      career,
      employments,
      education,
      certifications,
      skills,
      projects,
      volunteers,
      evidence,
      achievements,
      jobs,
      applications,
      resumes,
      coverLetters,
      answers,
      stories,
      interviews,
      followUps,
      learning,
      entitlements,
    ] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.careerMasterProfile.findUnique({ where: { userId } }),
      prisma.employmentRecord.findMany({ where: { userId } }),
      prisma.educationRecord.findMany({ where: { userId } }),
      prisma.certification.findMany({ where: { userId } }),
      prisma.skill.findMany({ where: { userId } }),
      prisma.project.findMany({ where: { userId } }),
      prisma.volunteerExperience.findMany({ where: { userId } }),
      prisma.evidence.findMany({ where: { userId } }),
      prisma.achievement.findMany({ where: { userId } }),
      prisma.jobPosting.findMany({ where: { userId } }),
      prisma.application.findMany({ where: { userId } }),
      prisma.resume.findMany({ where: { userId } }),
      prisma.coverLetter.findMany({ where: { userId } }),
      prisma.applicationAnswer.findMany({ where: { userId } }),
      prisma.starStory.findMany({ where: { userId } }),
      prisma.interview.findMany({ where: { userId } }),
      prisma.followUp.findMany({ where: { userId } }),
      prisma.learningEvent.findMany({ where: { userId } }),
      prisma.entitlement.findMany({
        where: { userId },
        select: { plan: true, status: true, source: true, createdAt: true },
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      appVersion: process.env.APP_VERSION ?? "1.0.0",
      note: "Passwords, session tokens and stored API keys are never included in an export.",
      profile: profile ? { ...profile, userId: undefined } : null,
      settings: settings ? { ...settings, userId: undefined } : null,
      career,
      employments,
      education,
      certifications,
      skills,
      projects,
      volunteers,
      evidence,
      achievements,
      jobs,
      applications,
      resumes,
      coverLetters,
      applicationAnswers: answers,
      starStories: stories,
      interviews,
      followUps,
      learningEvents: learning,
      entitlements,
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="acme-career-export.json"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const err = asAppError(e);
    return new Response(JSON.stringify({ error: userFacingMessage(err) }), {
      status: err.status,
      headers: { "content-type": "application/json" },
    });
  }
}
