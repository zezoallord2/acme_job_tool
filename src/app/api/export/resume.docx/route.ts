import { requireUser } from "@/lib/auth";
import {
  ensureMasterResume,
  getResume,
  RESUME_CONTENT_SCHEMA,
} from "@/services/resume-service";
import { buildDocx } from "@/lib/docx";
import { asAppError, userFacingMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const master = await ensureMasterResume(user.id);
    const resume = await getResume(user.id, master.id);
    const content = RESUME_CONTENT_SCHEMA.parse(
      resume.versions[0]?.content ?? {},
    );

    const buffer = await buildDocx({
      title: content.contact.fullName || "My Resume",
      subtitle: "My Resume",
      contact: [
        content.contact.email,
        content.contact.phone,
        content.contact.location,
      ].filter(Boolean),
      sections: [
        { heading: "Summary", lines: [content.summary] },
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
      ],
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": 'attachment; filename="acme-master-resume.docx"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const err = asAppError(e);
    return new Response(userFacingMessage(err), { status: err.status });
  }
}
