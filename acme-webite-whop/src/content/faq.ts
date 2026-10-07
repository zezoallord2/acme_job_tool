export interface FaqItem {
  question: string;
  /** Plain-text answer, used for FAQPage structured data and the accordion body. */
  answer: string;
  group: 'Basics' | 'Free guide' | 'Method' | 'Results' | 'Platform';
}

export const faqs: FaqItem[] = [
  {
    group: 'Basics',
    question: 'What is Acme Jobs?',
    answer:
      'Acme Jobs is a career-preparation brand built around one idea: AI should help you use your real experience more effectively, not replace it. We publish practical systems for analysing job descriptions, improving resumes, preparing for interviews and managing an application process — plus an interactive app in development.',
  },
  {
    group: 'Basics',
    question: 'Is the Starter Guide really free?',
    answer:
      'Yes. The AI Job Search Starter Guide is free, and it is the intended starting point. There is no trial period, no credit card step and no paid AI subscription required to follow it.',
  },
  {
    group: 'Free guide',
    question: 'Do I need ChatGPT Plus?',
    answer:
      'No. The Starter Guide is designed to work with free-tier AI assistants, including ChatGPT, Claude, Gemini and Microsoft Copilot free versions. A paid subscription can be convenient, but it is not required and it will not change the method.',
  },
  {
    group: 'Method',
    question: 'Does Acme Jobs write fake experience?',
    answer:
      'That is the opposite of the point. The Acme Jobs method starts from what you have genuinely done and shows you how to make it clearer and better targeted. Missing evidence is better than invented evidence, because invented evidence is what you get asked about in the interview.',
  },
  {
    group: 'Method',
    question: 'What AI tools can I use?',
    answer:
      'Any mainstream AI assistant that accepts long text: ChatGPT, Claude, Gemini, Microsoft Copilot, Perplexity, or a local model. The important part is the workflow and the prompts, not the brand. Review every suggestion before you use it.',
  },
  {
    group: 'Results',
    question: 'Does this guarantee a job?',
    answer:
      'No. No honest career product can promise that. Hiring depends on the market, the employer, the role and factors outside your control. What Acme Jobs can do is help you submit clearer, better-targeted, more consistent applications based on evidence you can defend.',
  },
  {
    group: 'Results',
    question: 'Does this beat ATS?',
    answer:
      'We do not claim to “beat” applicant tracking systems, and we will not invent an ATS score for you. Modern ATS platforms mostly parse and route applications; they do not score your worth. Clear formatting, honest keywords and relevant evidence help you be read correctly — that is the honest version of this claim.',
  },
  {
    group: 'Results',
    question: 'Can fresh graduates use it?',
    answer:
      'Yes, and the Starter Guide is deliberately scoped for this. Early-career applicants mostly need help turning coursework, projects, part-time work, volunteering and group assignments into clear, defensible evidence — which is exactly what the Career Snapshot and STAR Story Builder teach.',
  },
  {
    group: 'Results',
    question: 'Can career changers use it?',
    answer:
      'Yes. Career changers usually have more experience than their target role suggests; the problem is translation. The workflow helps you map transferable evidence onto the requirements of a new industry without claiming experience you do not have.',
  },
  {
    group: 'Method',
    question: 'Can I use it for multiple jobs?',
    answer:
      'Yes — that is the design. The Career Master Profile is built once and reused, while the analysis, tailoring and preparation steps run per role. The Complete Edition is aimed squarely at people applying to many roles and want a repeatable system rather than one-off help.',
  },
  {
    group: 'Free guide',
    question: "What's the difference between Free and Complete?",
    answer:
      'The Starter Guide is a focused introduction: one real job posting, six core modules and a 30-minute workflow. The Complete Edition is the full system — a Career Master Profile, achievement mining, deep job analysis, tailored resume and bullet work, cover letters, application answers, LinkedIn positioning, a full STAR story bank and advanced interview preparation.',
  },
  {
    group: 'Platform',
    question: 'Is the Acme Jobs app available yet?',
    answer:
      'Not yet. The Acme Jobs app is in development. We are building a Career Evidence Profile, job analysis, claim verification, resume workspace, interview preparation and application tracking. The early-access list is the way to hear about it first — the app is not currently available.',
  },
  {
    group: 'Basics',
    question: 'Where do I get the products?',
    answer:
      'Both products are delivered through our checkout provider. Every “Start free” and “Get AI Job Hunter” button on this site points at the correct checkout page. You will be able to download the material immediately after purchase.',
  },
  {
    group: 'Basics',
    question: 'Can my company or team buy it?',
    answer:
      'These products are written for individual job seekers. If you are a career service, bootcamp or coach interested in using the method with a group, contact us and we will point you to the most suitable option.',
  },
];

export const faqGroups = ['Basics', 'Free guide', 'Method', 'Results', 'Platform'] as const;

export function faqsForJsonLd(): { question: string; answer: string }[] {
  return faqs.map(({ question, answer }) => ({ question, answer }));
}
