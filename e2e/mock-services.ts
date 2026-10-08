import { createServer, type Server } from "node:http";

/**
 * Local stand-ins for the hosted AI provider and one job feed, used only by the
 * AI journey spec. The app talks to them through its normal configuration
 * (OPENAI_BASE_URL, REMOTIVE_API_URL), so the code under test is the real code.
 *
 * The fake model answers by recognising which workflow's system prompt it got.
 */
export const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3299);

const DESCRIPTION =
  "Own end-to-end product design for our web and mobile app: research, flows, prototypes in Figma and a design system shared with engineering.";

function remotiveJobs() {
  return {
    jobs: Array.from({ length: 60 }, (_, i) => ({
      id: 9000 + i,
      url: `https://remotive.com/remote-jobs/design/product-designer-${i}`,
      title: i % 3 === 0 ? "Senior Product Designer" : "Product Designer",
      company_name: `Mock Studio ${i}`,
      candidate_required_location: "Worldwide",
      description: `<p>${DESCRIPTION}</p>`,
      publication_date: "2026-10-01T09:00:00",
      job_type: "full_time",
      category: "Design",
    })),
  };
}

function answerFor(system: string, user: string): unknown {
  if (system.includes("You plan a job search")) {
    return {
      queries: [
        { title: "Product Designer", reason: "Target role" },
        { title: "UX Designer", reason: "Synonym" },
        { title: "UI Designer", reason: "Adjacent" },
        { title: "Senior Product Designer", reason: "Seniority" },
      ],
      companies: [],
      industries: ["design"],
    };
  }
  if (system.includes("You rank job listings")) {
    const indices = [...user.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    return {
      ranked: indices.map((i) => ({
        i,
        fit: Math.max(10, 95 - i),
        why: "Product design in Figma matches the design work on your CV.",
      })),
    };
  }
  if (system.includes("You are an expert resume writer")) {
    return {
      summary:
        "Designer who turns research into clear product flows, working closely with engineering.",
      prioritizedSkills: ["Figma", "Kubernetes"],
      experiences: [],
      changes: [
        {
          section: "summary",
          what: "Rewrote the summary",
          why: "Leads with product design, which this job asks for first.",
        },
      ],
      jobKeywords: ["product design", "Figma", "design system", "prototypes"],
      gaps: [
        {
          requirement: "design system",
          question: "Have you built or maintained a design system? Where?",
        },
      ],
      droppedPoints: [],
      needsInput: [],
    };
  }
  if (system.includes("realistic mock interview")) {
    const slots = [
      ...user.matchAll(/^\d+\. (OPENER|BEHAVIOURAL|ROLE|GAP|CLOSER)/gm),
    ].map((m) => m[1]);
    const text: Record<string, string> = {
      OPENER: "Walk me through your background and why this design role.",
      BEHAVIOURAL:
        "Tell me about a time you changed a design after user research.",
      ROLE: "How would you structure a design system for a growing product team?",
      GAP: "This role needs design-system experience. How would you close that gap?",
      CLOSER: "Do you have any questions for us?",
    };
    return {
      questions: slots.map((slot, i) => ({
        question: `${text[slot!] ?? text.ROLE} (${i + 1})`,
        category: slot === "BEHAVIOURAL" ? "BEHAVIORAL" : "GENERAL",
        slot,
        rationale: `Mock ${slot}`,
        expectedSignals: [],
        targetsRequirement: null,
      })),
    };
  }
  if (system.includes("interview coach scoring ONE answer")) {
    return {
      relevance: 4,
      specificity: 3,
      evidence: 3,
      structure: 4,
      clarity: 4,
      wasVague: false,
      unsupportedClaims: [],
      followUpQuestion: "What changed for users afterwards?",
      coachNote: "",
      strength: "You described the research step clearly.",
      improvement: "End with the result for users, in one sentence.",
      strongerAnswer:
        "In my last role I ran user interviews, found the checkout flow confused people, and redesigned it with engineering.",
    };
  }
  return {};
}

export function startMockServices(): Promise<Server> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.url?.startsWith("/remotive")) return send(200, remotiveJobs());
      if (req.url?.startsWith("/v1/chat/completions")) {
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as {
          messages?: Array<{ role: string; content: string }>;
        };
        const system =
          body.messages?.find((m) => m.role === "system")?.content ?? "";
        const user =
          body.messages?.find((m) => m.role === "user")?.content ?? "";
        return send(200, {
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify(answerFor(system, user)),
              },
            },
          ],
        });
      }
      send(404, { error: "not mocked" });
    });
  });
  return new Promise((resolve) =>
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve(server)),
  );
}
