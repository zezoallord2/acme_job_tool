import type { Article } from './types';

export const careerChangeResume: Article = {
  slug: 'career-change-resume-guide',
  title: 'Career Change Resume Guide: Translating Experience Without Overclaiming',
  description:
    'How to write a resume for a career change: translate transferable evidence into your target industry’s language without pretending to have experience you do not have.',
  intent: 'career change resume',
  section: 'Career change',
  published: '2026-02-16',
  updated: '2026-03-02',
  readingMinutes: 8,
  summary:
    'Career changers usually have more relevant experience than their new industry realises. The work is translation — and the one thing you must not do is compress years of experience into a misleading job title.',
  sections: [
    {
      id: 'what-employers-actually-worry-about',
      heading: 'What employers actually worry about',
      blocks: [
        {
          type: 'paragraph',
          text: 'A hiring manager considering a career changer is usually weighing three things: can this person do the work, will they stick, and can I trust their claims. Only the third is a resume problem. The first two are answered in the interview.',
        },
        {
          type: 'paragraph',
          text: 'So the resume’s job is narrower than changers think: it has to make the transferable evidence visible and keep every claim checkable.',
        },
      ],
    },
    {
      id: 'find-the-translation',
      heading: 'Find the translation',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Analyse the target role properly',
              text: 'Extract hard requirements from the posting, as you would for any application. Write them as behaviours and outputs, not as job titles.',
            },
            {
              title: 'List your real evidence in plain text',
              text: 'Years of it, unsummarised. Do not filter for relevance yet — that comes next.',
            },
            {
              title: 'Match on outcomes, not titles',
              text: '“Managed a team of six” is relevant to almost anything. A supervisor title from a different industry is not. Match on what changed because you were there.',
            },
            {
              title: 'Use the target industry’s words for real work',
              text: 'If you did customer retention work and they call it account management, use their word — for the work you actually did.',
            },
          ],
        },
        {
          type: 'callout',
          title: 'Prompt that works',
          text: '“Here is my real experience: [plain text]. Here are the requirements of the target role: [list]. Match each requirement to evidence I actually have. Use only what I described. Where there is no direct evidence, say ‘no direct evidence’ and suggest the closest adjacent thing. Then list the three requirements I should address in a cover letter.”',
        },
      ],
    },
    {
      id: 'the-honesty-line',
      heading: 'The honesty line, and where to put it',
      blocks: [
        {
          type: 'paragraph',
          text: 'There is a line between translating and overclaiming, and it is worth being precise about. Translating is describing real work in the vocabulary of the new field. Overclaiming is implying you held a role, used a tool or delivered an outcome you did not.',
        },
        {
          type: 'list',
          items: [
            'Translate: “Ran weekly performance reviews for six staff” becomes “Ran a regular performance review cycle with six direct reports”.',
            'Overclaim: turning the same thing into “HR Business Partner”.',
            'Translate: “Handled customer complaints in retail” becomes “Managed escalations and retention conversations in a high-volume service environment”.',
            'Overclaim: “Managed key accounts”.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Where the gap is real, address it directly. A single clear sentence in a cover letter — naming the change, naming what you have done about it, and naming what you want next — does more for your candidacy than any amount of careful phrasing.',
        },
      ],
    },
    {
      id: 'structure-for-change',
      heading: 'Structure for a change, not a promotion',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Add a short transition line',
              text: 'One or two lines under your name: what you are moving from, what you are moving into, and the strongest piece of evidence for why.',
            },
            {
              title: 'Lead with transferable evidence',
              text: 'Reorder sections so the experience most relevant to the new role comes first, regardless of chronology.',
            },
            {
              title: 'Keep the chronology available',
              text: 'Dates stay on every role. A resume that appears to hide your history invites suspicion rather than curiosity.',
            },
            {
              title: 'Make the learning visible',
              text: 'Courses, certifications and voluntary work in the new field count here, provided you describe what you actually did rather than what the course covered.',
            },
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'How do I explain a career change in one line?',
      answer:
        'Name the move, the reason in a few words, and the evidence that makes you credible: “Support operations lead moving into product operations after eight years running customer-facing service teams.” Specific and unfussy beats inspiring every time.',
    },
    {
      question: 'Should I keep my old industry terms?',
      answer:
        'Keep the terms that are recognisable and precise, and add the new industry’s equivalent where the work genuinely matches. Fully translating everything makes your history harder to verify, which is the opposite of what you want.',
    },
    {
      question: 'Is it worth getting certified in the new field first?',
      answer:
        'It helps when the certification is genuinely part of the work — clinical, engineering, legal, finance. For generalist roles, evidence of real work in the new field usually carries more weight than another certificate.',
    },
  ],
  related: [
    {
      label: 'How to tailor a resume with AI without lying',
      href: '/resources/how-to-tailor-a-resume-with-ai-without-lying',
    },
    { label: 'Fresh graduate resume guide', href: '/resources/fresh-graduate-resume-guide' },
    {
      label: 'How to decide whether a job is worth applying for',
      href: '/resources/how-to-decide-whether-a-job-is-worth-applying-for',
    },
  ],
};
