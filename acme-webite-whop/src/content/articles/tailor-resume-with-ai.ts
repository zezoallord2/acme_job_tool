import type { Article } from './types';

export const tailorResumeWithAi: Article = {
  slug: 'how-to-tailor-a-resume-with-ai-without-lying',
  title: 'How to Tailor a Resume With AI Without Lying',
  description:
    'A practical method for tailoring your resume to a job description with AI — matching real evidence to real requirements, without inventing metrics, tools or experience.',
  intent: 'resume tailoring with AI',
  section: 'Resumes',
  published: '2026-01-14',
  updated: '2026-02-11',
  readingMinutes: 8,
  summary:
    'Tailoring means showing the employer the parts of your real experience that match their requirements. AI can help you do that quickly, as long as you keep the evidence and the job description on the table and forbid invention.',
  sections: [
    {
      id: 'what-tailoring-actually-means',
      heading: 'What tailoring actually means',
      blocks: [
        {
          type: 'paragraph',
          text: 'Tailoring is not decoration. It is selection plus emphasis. You already have real experience — tailoring is the work of working out which parts of it this specific employer is going to care about, and making those parts easy to find.',
        },
        {
          type: 'paragraph',
          text: 'The failure mode is subtler than lying. Most people overcorrect in the other direction: they compress everything into the same three pages and hope the reader finds the relevant part. That is not tailoring, and it is why applications still feel generic.',
        },
        {
          type: 'list',
          items: [
            'Do: reorder sections so the most relevant evidence appears first.',
            'Do: rewrite bullets so the outcome and the scope are explicit.',
            'Do: mirror the employer’s own language for things you genuinely did.',
            'Don’t: add a tool, a certification or a job title you do not have.',
            'Don’t: inflate a number because it “sounds better” — you will be asked.',
          ],
        },
      ],
    },
    {
      id: 'step-1-extract-the-requirements',
      heading: 'Step 1: Extract the real requirements first',
      blocks: [
        {
          type: 'paragraph',
          text: 'Never ask AI to “tailor my resume” while looking at the job description. It will produce something plausible. Instead, ask it to analyse the posting on its own terms and give you a list. You want three groups: hard requirements, preferences, and the things the posting implies but does not say.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Paste the posting on its own',
              text: 'Paste only the job description into a fresh AI chat. Do not include your resume yet — you want an unbiased read of what they are asking for.',
            },
            {
              title: 'Ask for three lists',
              text: 'Ask for: (1) must-have requirements, (2) genuinely optional preferences, (3) implied expectations that are not written down, such as the seniority the team assumes.',
            },
            {
              title: 'Check the implied list',
              text: 'The implied list is where tailoring usually happens. A job that asks for stakeholder management usually implies you will work with people who disagree with you.',
            },
          ],
        },
        {
          type: 'callout',
          tone: 'note',
          title: 'Do this by hand too',
          text: 'Read the posting and mark the requirements yourself before you read the AI’s list. Ten minutes of your own judgement prevents you from accepting a wrong interpretation later.',
        },
      ],
    },
    {
      id: 'step-2-match-evidence',
      heading: 'Step 2: Match your evidence to those requirements',
      blocks: [
        {
          type: 'paragraph',
          text: 'This is the step AI is genuinely good at, because it is a comparison task rather than a writing task. Give the AI your requirement list, then your real experience in plain text, and ask for a match table — including the gaps.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Include a hard rule in the prompt',
          text: 'Add this line: “Only use experience I have described. If a requirement is not covered, write ‘no direct evidence’. Never infer, upgrade or estimate.” Without it, you will get a gap-free table, which is exactly the problem you are trying to avoid.',
        },
        {
          type: 'paragraph',
          text: 'The gaps are the most valuable output. A gap you can address with a reframe is a non-issue. A gap you cannot address needs to be acknowledged in your cover letter or simply accepted as a reason not to spend three hours on the application.',
        },
      ],
    },
    {
      id: 'step-3-rewrite-only-what-you-own',
      heading: 'Step 3: Rewrite only the bullets you own',
      blocks: [
        {
          type: 'paragraph',
          text: 'Now — and only now — start editing. Feed the AI one bullet at a time, along with the requirement it is meant to answer. Ask for three versions at different levels of concision, then pick the one that is still true when you read it out loud.',
        },
        {
          type: 'example',
          title: 'A bullet that stays honest',
          before: 'Responsible for handling customer onboarding and improving the process.',
          after:
            'Onboarded 14 mid-market accounts in my previous role, and rewrote the intake checklist that the support team still uses.',
        },
        {
          type: 'paragraph',
          text: 'The second version adds no invented metric and no new technology. It adds scope, specificity and an honest artefact. That is what tailoring looks like when it is done properly.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'One requirement, one bullet. If a bullet is doing three jobs, split it.',
            'Put the outcome before the process where you genuinely have one.',
            'Remove job-title inflation you inherited from a job description.',
            'Delete any sentence you could not defend for five minutes under questioning.',
          ],
        },
      ],
    },
    {
      id: 'step-4-verify',
      heading: 'Step 4: Verify before you submit',
      blocks: [
        {
          type: 'paragraph',
          text: 'Run the claim check: for every number, tool, certification and responsibility in the document, ask “where in my own history is this supported?” Anything you cannot answer in one sentence comes out. Not because it is a small lie — because it will surface in the interview.',
        },
        {
          type: 'callout',
          tone: 'note',
          title: 'Keep one master version',
          text: 'Save the unedited version of your resume as your single source of truth. Every tailored version should be a copy of it, not a new original. This is what stops the “which file did I actually send?” problem.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Is tailoring a resume the same as lying?',
      answer:
        'No. Tailoring is choosing emphasis. Lying is asserting something that is not true — a metric you did not achieve, a tool you have never used, a responsibility you did not have. Every version of your resume should still be defensible in an interview.',
    },
    {
      question: 'Should I use the exact keywords from the job description?',
      answer:
        'Only where they describe something you genuinely did. Using an employer’s phrasing for real experience makes your resume easier to evaluate. Copying their phrasing for experience you do not have is the problem, not the keywords.',
    },
    {
      question: 'How much should I change between applications?',
      answer:
        'Usually the top third: your summary, your section order, and the bullets aimed at the role’s top three requirements. The rest can stay stable. If you are rewriting everything each time, you are working without a source of truth.',
    },
    {
      question: 'Can AI tailor my resume if I upload my current one?',
      answer:
        'It can help, but upload a plain-text version of your real experience rather than your finished resume. Finished resumes contain years of accumulated padding that the model will happily preserve.',
    },
  ],
  related: [
    {
      label: 'How to analyze a job description before applying',
      href: '/resources/how-to-analyze-a-job-description-before-applying',
    },
    {
      label: 'How to use ChatGPT for your resume without sounding generic',
      href: '/resources/how-to-use-chatgpt-for-your-resume-without-sounding-generic',
    },
    { label: 'AI Job Search Starter Guide (free)', href: '/free' },
  ],
};
