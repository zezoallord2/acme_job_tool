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
    // Colours taken from public/brand/logo.png.
    background_color: "#001E54",
    theme_color: "#001E54",
    categories: ["productivity", "business", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Raster markable, because Android crops the vector unpredictably.
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
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
        name: "My Experience",
        short_name: "Evidence",
        url: "/app/evidence",
        description: "What you can actually prove",
      },
      {
        name: "Acme Assistant",
        short_name: "Ask",
        url: "/app/ask",
        description: "Ask about your own data",
      },
    ],
  };
}
