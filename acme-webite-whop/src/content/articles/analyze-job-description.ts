import type { Article } from './types';

export const analyzeJobDescription: Article = {
  slug: 'how-to-analyze-a-job-description-before-applying',
  title: 'How to Analyze a Job Description Before Applying',
  description:
    'Break a job description into must-have requirements, preferences and hidden expectations before you apply — so you target the real job instead of the keywords.',
  intent: 'job description analyzer',
  section: 'Job search',
  published: '2026-01-21',
  updated: '2026-02-18',
  readingMinutes: 7,
  summary:
    'A job description is a compressed brief, not a wish list. Reading it properly takes fifteen minutes and tells you whether the role is worth an application at all.',
  sections: [
    {
      id: 'three-layers',
      heading: 'Every posting has three layers',
      blocks: [
        {
          type: 'paragraph',
          text: 'Most applicants read only the first layer — the list of skills. The useful information is spread across three: what they wrote, what they emphasised, and what they assumed you already know.',
        },
        {
          type: 'list',
          items: [
            'Layer 1 — Stated: the skills and responsibilities they listed.',
            'Layer 2 — Emphasised: where they repeated themselves or wrote more detail than the rest.',
            'Layer 3 — Assumed: the seniority, pace and working style they did not bother to state.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Layer 2 is where the actual priorities live. If a posting gives four sentences to revenue operations and one line to brand, the role is not a brand role — regardless of the job title.',
        },
      ],
    },
    {
      id: 'extract-the-brief',
      heading: 'Extract a one-page brief',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Separate must-have from nice-to-have',
              text: 'Anything in the first third of the posting, repeated twice, or attached to a hard requirement (“must”, “required”, “you will”) is a must-have. The rest is preference.',
            },
            {
              title: 'Name the actual problem',
              text: 'Ask: what is this person expected to have fixed within six months? Write one sentence. If you cannot, the posting is under-specified and that is a risk for you, not an opportunity.',
            },
            {
              title: 'List the hidden requirements',
              text: 'Things like unclear decision-making rights, a lot of stakeholder conflict, or a fast pace usually appear in the adjectives rather than the bullet points.',
            },
            {
              title: 'Write your evidence line',
              text: 'For each must-have, write one sentence of real experience that addresses it. Anything you cannot fill in is a gap you now know about.',
            },
          ],
        },
      ],
    },
    {
      id: 'use-ai-as-analyst',
      heading: 'Use AI as an analyst, not a writer',
      blocks: [
        {
          type: 'paragraph',
          text: 'This is one of the strongest uses of AI in a job search, because analysis is a bounded task with a checkable answer. Paste the posting into a fresh chat and give it a specific job to do.',
        },
        {
          type: 'callout',
          title: 'Prompt that works',
          text: '“Analyse this job description. Give me: (1) five hard requirements, ranked, (2) three preferences, (3) three expectations implied but not stated, (4) the single biggest risk to me as a candidate, (5) three questions I should ask at interview. Use only this posting — do not assume anything about the company.”',
        },
        {
          type: 'paragraph',
          text: 'Requesting the risk and the interview questions is what separates useful output from a summary. It also gives you material for the application itself, not just for the decision.',
        },
      ],
    },
    {
      id: 'decide',
      heading: 'Decide whether to apply at all',
      blocks: [
        {
          type: 'paragraph',
          text: 'Most wasted effort in a job search comes from applying to roles that were never a realistic match. Now that you have a requirement list, use it honestly.',
        },
        {
          type: 'list',
          items: [
            'Apply when you can cover most hard requirements and can defend each claim.',
            'Apply cautiously when you miss one hard requirement but have strong adjacent evidence.',
            'Skip when two or more hard requirements are genuinely absent — unless the role is a stretch you specifically want.',
          ],
        },
        {
          type: 'callout',
          tone: 'note',
          title: 'Keep the brief',
          text: 'Save your one-page brief next to the application. When the interview arrives, you will need the requirement ranking again — and you will not want to rebuild it from scratch.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'How long should a job description analysis take?',
      answer:
        'Fifteen minutes by hand, plus ten with AI if you want a second read. That is a small investment compared with the two to four hours a full application takes — and it is how you avoid spending those hours on the wrong role.',
    },
    {
      question: 'What if the job description is vague?',
      answer:
        'Treat the vagueness as information. Ask about decision rights, success measures and team structure in your interview questions. A posting that cannot describe success usually cannot evaluate it either.',
    },
    {
      question: 'Should I apply if I only meet about half the requirements?',
      answer:
        'It depends on which half. Missing a nice-to-have is fine. Missing a core requirement for the role is worth thinking about carefully, though many people over-weight requirements that were listed to sound demanding.',
    },
  ],
  related: [
    {
      label: 'How to tailor a resume with AI without lying',
      href: '/resources/how-to-tailor-a-resume-with-ai-without-lying',
    },
    {
      label: 'How to decide whether a job is worth applying for',
      href: '/resources/how-to-decide-whether-a-job-is-worth-applying-for',
    },
    {
      label: 'STAR interview method: practical examples',
      href: '/resources/star-interview-method-practical-examples',
    },
  ],
};
