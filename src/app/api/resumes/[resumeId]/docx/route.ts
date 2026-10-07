import { requireUser } from "@/lib/auth";
import { getResume, RESUME_CONTENT_SCHEMA } from "@/services/resume-service";
import { buildDocx } from "@/lib/docx";
import { asAppError, userFacingMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resumeId: string }> },
) {
  try {
    const user = await requireUser();
    const { resumeId } = await params;
    const resume = await getResume(user.id, resumeId);
    const content = RESUME_CONTENT_SCHEMA.parse(
      resume.versions[0]?.content ?? {},
    );

    const buffer = await buildDocx({
      title: content.contact.fullName || resume.label,
      subtitle: resume.label,
      contact: [
        content.contact.email,
        content.contact.phone,
        content.contact.location,
      ].filter(Boolean),
      sections: [
        content.summary
          ? { heading: "Summary", lines: [content.summary] }
          : { heading: "Summary", lines: [] },
        { heading: "Skills", lines: content.skills.map((s) => `• ${s}`) },
        {
          heading: "Experience",
          lines: content.experiences.flatMap((e) => [
            `${e.title} — ${e.company}`,
            ...e.bullets.map((b) => `• ${b}`),
            "",
          ]),
        },
        {
          heading: "Projects",
          lines: content.projects.flatMap((p) => [
            p.name,
            ...p.bullets.map((b) => `• ${b}`),
            "",
          ]),
        },
        {
          heading: "Education",
          lines: content.education.map((e) =>
            [e.degree, e.field, e.institution].filter(Boolean).join(" — "),
          ),
        },
        {
          heading: "Certifications",
          lines: content.certifications.map((c) => `• ${c.name}`),
        },
      ],
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${resume.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.docx"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const err = asAppError(e);
    return new Response(userFacingMessage(err), { status: err.status });
  }
}
