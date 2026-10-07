export const brandPromise = 'Your experience. AI-assisted. Never invented.' as const;

export const brandTagline = 'Better Opportunities Ahead.' as const;

/** The Acme Jobs navy/teal LiquidEther ramp. */
export const liquidPalette = ['#0B2D4D', '#118E94', '#24C3C8', '#0E3A5C'] as const;

export const liquidEtherPresets = {
  hero: {
    autoDemo: true,
    autoSpeed: 0.42,
    autoIntensity: 0.62,
    mouseForce: 3,
    cursorSize: 0.62,
    resolution: 'auto' as const,
    BFECC: true,
  },
  band: {
    autoDemo: true,
    autoSpeed: 0.3,
    autoIntensity: 0.42,
    mouseForce: 2,
    cursorSize: 0.78,
    resolution: 'auto' as const,
    BFECC: true,
  },
};

export const freeProduct = {
  id: 'free-starter-guide',
  badge: 'Start here — Free',
  name: 'AI Job Search Starter Guide',
  edition: 'Free Edition',
  price: '$0',
  headline: 'Improve One Real Application for Free.',
  summary:
    'A practical introduction to using AI for the parts of a job search that actually move things forward — without inventing anything about yourself.',
  mainMessage: 'Start with one real job posting and improve your next application.',
  supports: [
    'Career Snapshot',
    'Resume Quick Check',
    'Job Description Analysis',
    'Basic Resume Tailoring',
    'STAR Interview Preparation',
    'AI Mock Interview',
  ],
  workflow: '30-Minute Job Search Workflow',
  microcopy: 'No paid AI subscription required.',
  cta: 'Get the free guide',
} as const;

export const paidProduct = {
  id: 'complete-edition',
  badge: 'Complete system',
  name: 'AI Job Hunter',
  edition: 'Complete Edition',
  launchPrice: '$9.99',
  regularPrice: '$14.99',
  headline: 'Ready to Go Further?',
  summary:
    'The full AI-assisted job-search workbook: it takes the starter workflow deeper into evidence mining, deep job analysis, tailored application writing, and interview preparation you can reuse for every role.',
  modules: [
    {
      title: 'Career Master Profile',
      description:
        'One structured, living record of your real experience, skills and constraints — the source every later step draws from.',
    },
    {
      title: 'Achievement Mining',
      description:
        'A repeatable method for turning vague job duties into specific, defensible accomplishments you can actually talk about.',
    },
    {
      title: 'Deep Job Analysis',
      description:
        'Break a job description into must-haves, nice-to-haves, hidden requirements and evaluation criteria before you write a word.',
    },
    {
      title: 'Resume Tailoring System',
      description:
        'Match evidence to requirements and rebuild the relevant sections for one specific role, not a generic master document.',
    },
    {
      title: 'Resume Bullet Improvement',
      description:
        'Tighten weak bullets into clear, specific, outcome-shaped lines without inflating what you did.',
    },
    {
      title: 'Cover Letter Workflow',
      description:
        'Draft a short, specific letter that connects your evidence to this employer’s actual needs — without clichés.',
    },
    {
      title: 'Application Answers',
      description:
        'Structured prompts for the awkward form questions: motivation, salary, notice period, work authorisation, gaps.',
    },
    {
      title: 'LinkedIn Positioning',
      description:
        'Rewrite your headline, About section and feature bullets so recruiters can find the work you want next.',
    },
    {
      title: 'STAR Story Bank',
      description:
        'Build and store a reusable bank of Situation–Task–Action–Result stories, one per competency the role cares about.',
    },
    {
      title: 'Advanced Mock Interviews',
      description:
        'Longer, role-specific practice sets with behavioural, technical and “tell me about yourself” coverage.',
    },
    {
      title: 'Interview Preparation',
      description:
        'Company research prompts, questions worth asking them, weaknesses to pre-empt, and questions you should be asking yourself.',
    },
    {
      title: 'Post-Interview Review',
      description:
        'Capture what you were asked, what you answered well and what you would change — so the next interview starts sharper.',
    },
    {
      title: 'Complete Reusable Workflow',
      description:
        'The end-to-end sequence, wired together so the next application takes hours instead of starting from zero.',
    },
  ],
  cta: 'Get AI Job Hunter',
} as const;

export const comparison = {
  columns: ['Free Starter', 'Complete Edition'],
  rows: [
    { feature: 'Career Snapshot', free: 'Career Snapshot', complete: 'Full Career Master Profile' },
    { feature: 'Resume review', free: 'Resume Quick Check', complete: 'Advanced Resume Tailoring' },
    { feature: 'Job analysis', free: 'Basic Job Analysis', complete: 'Deep Job Analysis' },
    { feature: 'Interview stories', free: '1 STAR Story', complete: 'Full STAR Story System' },
    {
      feature: 'Mock interview',
      free: '5-Question Mock Interview',
      complete: 'Advanced Interview Preparation',
    },
    { feature: 'Workflow', free: 'Basic Workflow', complete: 'Complete Reusable Workflow' },
    {
      feature: 'Also included',
      free: '30-Minute Job Search Workflow',
      complete: 'Cover letters, application answers, LinkedIn positioning, post-interview review',
    },
  ],
} as const;

export const problems = [
  {
    title: 'Generic resume rewrites',
    description:
      'The same polished paragraphs come back for every role, and none of them sound like you or match the job.',
  },
  {
    title: 'Different information in every version',
    description:
      'You end up with seven resumes that contradict each other, so you can never be sure what you actually claimed.',
  },
  {
    title: 'AI inventing metrics or experience',
    description:
      'Tools “helpfully” add percentages, job titles and tools you have never touched — and then you get asked about them.',
  },
  {
    title: 'No idea what the employer actually needs',
    description:
      'The posting is a wall of text. You apply to the keywords instead of to the actual problems the role is solving.',
  },
  {
    title: 'Random prompts, no connected workflow',
    description:
      'You improve one paragraph, lose the thread, and start the next application from a blank page again.',
  },
  {
    title: 'Interview answers disconnected from the resume',
    description:
      'The resume says one thing, your answers say another, and the interviewer notices the gap.',
  },
  {
    title: 'Too many resume versions',
    description:
      'File names, dates and near-identical documents turn a simple application into a filing exercise.',
  },
  {
    title: 'Applications with no strategy',
    description:
      'No record of what you sent, where, or what you learned — so every application starts at zero.',
  },
] as const;

export const methodology = {
  generic: ['Your resume', 'AI rewrites it', 'Hope it is correct'],
  acme: [
    'Your real experience',
    'Job requirements',
    'Relevant evidence',
    'Targeted application',
    'Interview preparation',
  ],
  statement: "If you can't defend it in an interview, don't submit it.",
} as const;

export const neverInvented = [
  {
    title: 'Real experience',
    description:
      "Acme Jobs starts with what you've actually done — roles, projects, responsibilities and results.",
  },
  {
    title: 'Evidence-based',
    description:
      'Recommendations connect back to real skills, projects, achievements and responsibilities you can name.',
  },
  {
    title: 'You stay in control',
    description:
      'Review, edit, confirm or reject every suggestion before it goes anywhere near an application.',
  },
] as const;

export const workflowSteps = [
  {
    number: '1',
    title: "Tell us what's real",
    description: 'Build career information from your actual experience, in your own words.',
  },
  {
    number: '2',
    title: 'Understand the job',
    description: 'Break the job description down into what really matters in this role.',
  },
  {
    number: '3',
    title: 'Match your evidence',
    description:
      'Identify the experience, skills and results that genuinely support those requirements.',
  },
  {
    number: '4',
    title: 'Build the application',
    description: 'Improve your resume, your answers and your interview preparation together.',
  },
  {
    number: '5',
    title: 'Repeat the system',
    description:
      'Apply the same structured approach to the next role — starting from your evidence, not zero.',
  },
] as const;

export const audiences = [
  {
    title: 'Fresh graduates',
    description:
      'Limited experience is not a weakness — it is an evidence-mapping problem. Learn how to surface what you have genuinely done.',
    icon: 'graduation',
  },
  {
    title: 'Career changers',
    description:
      'Translate transferable experience into the language of a new industry without pretending you are something you are not.',
    icon: 'shuffle',
  },
  {
    title: 'Applicants getting few replies',
    description:
      'Usually an alignment problem, not a quality problem. Find out whether your evidence is reaching the requirement.',
    icon: 'search',
  },
  {
    title: 'Applying to competitive roles',
    description:
      'When hundreds of people apply, “good enough” disappears. Target the role deliberately and prepare to defend every line.',
    icon: 'target',
  },
  {
    title: 'Getting generic results from AI',
    description:
      'If every AI draft sounds the same, the problem is the process, not the tool. Give it better input.',
    icon: 'sparkles',
  },
] as const;

export const beforeAfter = {
  label: 'Workflow before / after',
  disclaimer:
    'This compares process, not outcomes. No tool can promise you a job, an interview or an offer.',
  before: [
    'One generic resume for everything',
    'Random prompts, one at a time',
    'Weak alignment to the specific role',
    'Different versions everywhere',
    'Vague interview preparation',
  ],
  after: [
    'Role-specific evidence, chosen deliberately',
    'One structured workflow, repeated',
    'Clearer tailoring to real requirements',
    'Application context preserved and consistent',
    'Prepared STAR stories you can defend',
  ],
} as const;

export const upcomingApp = {
  badge: 'Coming soon',
  headline: 'The Acme Jobs App Is Coming.',
  lede: "Acme Jobs is becoming more than a guide. We're turning the methodology into an interactive platform.",
  cards: [
    {
      title: 'Career Evidence',
      description:
        'A structured profile of the real experience, skills and achievements you can point back to.',
    },
    {
      title: 'Job Analyzer',
      description:
        'Paste a posting and see what it actually requires, ranked by weight and hidden signals.',
    },
    {
      title: 'Claim Inspector',
      description:
        'Highlights any claim in a draft that is not backed by your evidence, so you can fix it yourself.',
    },
    {
      title: 'Resume Workspace',
      description:
        'Tailored versions built from a single source of truth instead of duplicated files.',
    },
    {
      title: 'Interview Command Center',
      description:
        'Your STAR stories, likely questions and company research in one place per application.',
    },
    {
      title: 'Application Tracker',
      description:
        'Know what you sent, where, and what happened — so the next application is better informed.',
    },
  ],
  capabilities: [
    'Career Evidence Profile',
    'Job Analysis',
    'Resume Tailoring',
    'Claim Verification',
    'Interview Preparation',
    'Application Tracking',
    'Job Search Learning',
  ],
} as const;

export const affiliate = {
  headline: 'Share Acme Jobs. Earn When Someone Buys.',
  lede: 'Creators and career-focused pages can promote AI Job Hunter — Complete Edition through our affiliate programme.',
  audiences: [
    'Career creators',
    'Student creators',
    'AI creators',
    'Resume creators',
    'Job-search pages',
    'Career coaches',
  ],
  cta: 'Become an affiliate',
  commissionNote:
    'Commission rates and payout terms are confirmed in the programme agreement — we will not print numbers we cannot honour.',
} as const;

export const trustStrip = [
  'No fake experience',
  'No invented metrics',
  'No fake ATS scores',
] as const;

export const problemHeadline = "Using AI isn't the problem. Using it without a system is." as const;

export const methodHeadline = 'Evidence first.' as const;

export const neverInventedHeadline = 'AI should improve your story. Not invent one.' as const;

export const freeHeadline = 'Improve one real application for free.' as const;

export const paidHeadline = 'Ready to go further?' as const;

export const finalCta = {
  headline: 'Not sure where to start?',
  copy: 'Start with the free guide. Use it on one real job application. Upgrade only when you need the full system.',
} as const;

export const audienceHeadline = 'Built for real job seekers.' as const;

export const appCallout = 'Acme Jobs is becoming more than a guide.' as const;
