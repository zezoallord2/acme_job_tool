import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Acme Jobs — Better Opportunities Ahead",
    short_name: "Acme Jobs",
    description:
      "Evidence-first job search operating system. Every claim traceable to evidence.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f7f7f5",
    theme_color: "#0f3d2e",
    categories: ["productivity", "business", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Add a job",
        short_name: "Add job",
        url: "/app/jobs/new",
        description: "Paste a job description",
      },
      {
        name: "Evidence Ledger",
        short_name: "Evidence",
        url: "/app/evidence",
        description: "What you can actually prove",
      },
      {
        name: "Ask Acme",
        short_name: "Ask",
        url: "/app/ask",
        description: "Ask about your own data",
      },
    ],
  };
}
