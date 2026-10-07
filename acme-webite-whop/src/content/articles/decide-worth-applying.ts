import type { Article } from './types';

export const decideWorthApplying: Article = {
  slug: 'how-to-decide-whether-a-job-is-worth-applying-for',
  title: 'How to Decide Whether a Job Is Worth Applying For',
  description:
    'A repeatable way to triage job postings, spot red flags early and decide where to spend limited application hours — before you write a word.',
  intent: 'job search strategy',
  section: 'Job search',
  published: '2026-03-03',
  updated: '2026-03-08',
  readingMinutes: 7,
  summary:
    'A full application can take three hours. With a good triage method you spend twenty minutes deciding whether those three hours are justified — and stop applying to roles that were never going to work.',
  sections: [
    {
      id: 'why-triage-matters',
      heading: 'Why triage matters more than tailoring',
      blocks: [
        {
          type: 'paragraph',
          text: 'Most job search advice focuses on making each application better. That is worth doing, but only for the applications that should exist at all. A perfect application to a role you cannot realistically get, or should not want, is still a wasted evening.',
        },
        {
          type: 'paragraph',
          text: 'The goal of triage is to spend your limited hours where they have the highest chance of producing an interview — and to notice the disqualifying problems while the posting is still one scroll long.',
        },
      ],
    },
    {
      id: 'the-five-minute-screen',
      heading: 'The five-minute screen',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Hard requirement check',
              text: 'Pick the two or three requirements you definitely cannot satisfy. If any of them is genuinely disqualifying, stop here. If you are unsure, assume it is required.',
            },
            {
              title: 'Compensation reality check',
              text: 'Compare the stated or implied range with the market for the role and location. A posting with no range at all is not automatically bad, but it is worth a question.',
            },
            {
              title: 'Reposting and staleness',
              text: 'A role advertised for months with repeated reposts often signals a problem inside the team, or an over-qualified salary band. It is not a rule, but it is information.',
            },
            {
              title: 'What success looks like',
              text: 'Can you describe, from the posting alone, what this person will have achieved after six months? If not, you will not be able to answer their interview questions either.',
            },
            {
              title: 'Your own interest',
              text: 'Would you want this job if the application were easy? If the honest answer is no, that is the most reliable filter available.',
            },
          ],
        },
      ],
    },
    {
      id: 'red-flags',
      heading: 'Red flags worth noticing early',
      blocks: [
        {
          type: 'list',
          items: [
            'A very wide salary range against a very junior title — usually a levelling problem.',
            ' Responsibilities that describe two unrelated jobs — the role has not been designed yet.',
            'No mention of the team, manager or how success is measured, in an otherwise detailed posting.',
            'An interview process that asks you to do substantial unpaid project work.',
            'Enthusiasm for “rockstars”, “ninjas” and “families”, combined with no salary information.',
            'A company that will not tell you the salary range when asked directly.',
          ],
        },
        {
          type: 'callout',
          tone: 'note',
          title: 'Keep these proportional',
          text: 'Red flags are reasons to investigate, not to walk away automatically. Startups and small teams write worse job descriptions than large ones, and many are honest about uncertainty. Ask the question and judge the answer.',
        },
      ],
    },
    {
      id: 'using-ai-for-triage',
      heading: 'Using AI to triage faster',
      blocks: [
        {
          type: 'paragraph',
          text: 'AI is well suited to this, because triage is a bounded judgement task on a document you already have. The risk is that it will sound confident about a role it has never seen, so keep the decision yours.',
        },
        {
          type: 'callout',
          title: 'Triage prompt',
          text: '“Here is a job description and here is my real experience summary. Tell me: (1) hard requirements I clearly meet, (2) hard requirements I do not meet, (3) requirements where you are unsure, (4) three things I should investigate before applying, (5) a candid estimate of how competitive this role likely is, based only on what the posting reveals. Do not invent company facts.”',
        },
        {
          type: 'paragraph',
          text: 'Item five is the one to treat carefully. An assistant can tell you the posting is asking for a lot of experience; it cannot tell you how many applicants there are. Use its reasoning, not its verdict.',
        },
      ],
    },
    {
      id: 'track-your-triage',
      heading: 'Track it, or you will not learn',
      blocks: [
        {
          type: 'paragraph',
          text: 'Keep a simple log: posting, date applied, whether you passed triage, and what happened. Six weeks of this will show you which job titles, sources and companies actually convert for you — and that pattern is usually more useful than any individual piece of advice.',
        },
        {
          type: 'list',
          items: [
            'Which sources produce interviews rather than just applications.',
            'Which job titles you are consistently shortlisted for.',
            'Which of your strengths keeps coming up in the interviews you do get.',
            'Where you are losing: application, screening, interview, or offer stage.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'How many jobs should I apply to per week?',
      answer:
        'Fewer, better applications beat volume. If a careful application takes three hours and you have ten hours a week, three thoughtful applications will outperform ten generic ones — and you will have the energy to follow up.',
    },
    {
      question: 'Should I apply even if I only meet half the requirements?',
      answer:
        'Yes, if the half you miss is genuinely optional or you have strong adjacent evidence. No, if you are missing a core requirement for the role. The distinction is between “nice to have” and “the actual job”.',
    },
    {
      question: 'How do I tell if a company is a red flag?',
      answer:
        'Look for the combination: poor communication about the process, no salary range, a role that sounds undesigned, and an interview that requires unpaid project work. Any one of these can be innocent. All four together is a pattern.',
    },
  ],
  related: [
    {
      label: 'How to analyze a job description before applying',
      href: '/resources/how-to-analyze-a-job-description-before-applying',
    },
    { label: 'Career change resume guide', href: '/resources/career-change-resume-guide' },
    { label: 'AI Job Search Starter Guide (free)', href: '/free' },
  ],
};
