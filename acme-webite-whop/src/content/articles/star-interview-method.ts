import type { Article } from './types';

export const starInterviewMethod: Article = {
  slug: 'star-interview-method-practical-examples',
  title: 'STAR Interview Method: Practical Examples',
  description:
    'Real STAR interview answers for common behavioural questions, plus how to build a reusable story bank so you can answer whatever a role throws at you.',
  intent: 'AI interview preparation',
  section: 'Interviews',
  published: '2026-02-04',
  updated: '2026-02-24',
  readingMinutes: 9,
  summary:
    'STAR is a structure for answering behavioural questions: Situation, Task, Action, Result. The hard part is not the structure — it is having real stories with defensible results to put into it.',
  sections: [
    {
      id: 'what-star-really-is',
      heading: 'What STAR really is',
      blocks: [
        {
          type: 'paragraph',
          text: 'STAR is a memory aid, not a script. It gives you four slots to fill so that you do not ramble or skip the part that proves you can do the job.',
        },
        {
          type: 'list',
          items: [
            'Situation — brief context. Two or three sentences maximum, chosen to make the rest of the answer relevant.',
            'Task — what you specifically were responsible for, including the constraint you were working under.',
            'Action — what you personally did. This is the longest section and it must be in the first person.',
            'Result — the outcome, plus what you would do differently.',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'The most common mistake',
          text: 'Describing the team’s achievements as your own. Interviewers ask follow-up questions about “we” very quickly, and the shift from “we” to “I” under questioning is where candidates get caught out.',
        },
      ],
    },
    {
      id: 'worked-examples',
      heading: 'Three worked examples',
      blocks: [
        {
          type: 'example',
          title: '“Tell me about a time you handled a difficult stakeholder.”',
          before:
            'We had an issue with a client who was unhappy about the timeline. I arranged a meeting and we worked through the problems together to find a solution everyone was happy with.',
          after:
            'Situation: a key client refused to sign off a deliverable we had already built, two weeks before launch. Task: I was the project lead and accountable for getting that sign-off without conceding scope. Action: I stopped escalating by email, went to their office, and discovered their objection was about a compliance sign-off nobody had mentioned, not about the work itself. I brought our compliance lead into the next call, restructured the deliverable list around their approval criteria, and gave them a two-item review instead of the full document. Result: signed off nine days later with no scope change. I would now raise approval criteria at kick-off rather than at sign-off.',
        },
        {
          type: 'example',
          title: '“Describe a time you missed a deadline.”',
          before:
            'Unfortunately the project ran late because of changing requirements from the client and I did my best to manage the situation.',
          after:
            'Situation: I committed to a six-week data migration while also supporting a live release. Task: I owned both, and the release support was not optional. Action: I missed the first weekly checkpoint by three days, told my manager before she asked, and proposed cutting two low-value data fixes to protect the migration date. She agreed, and I sent the revised scope to the client the same day. Result: migration landed on the original date with the reduced scope, and the two cut fixes were picked up in the next quarter. What I learned: a late warning is much cheaper than a late deadline.',
        },
        {
          type: 'example',
          title: '“Tell me about something you changed about how you work.”',
          before:
            'I am a very organised and detail-oriented person who always tries to improve my processes and deliver high quality work to the team.',
          after:
            'Situation: I used to write long handover documents for every project I finished. Task: I was spending most of my last week on each role on documentation nobody read. Action: I asked three colleagues what they actually wanted to know when taking over my work, and replaced the document with a one-page summary plus a short recorded walkthrough. Result: handover time dropped from most of a day to about two hours, and two of the three people said it was the first handover documentation they had used end to end.',
        },
      ],
    },
    {
      id: 'build-a-bank',
      heading: 'Build a story bank before you need one',
      blocks: [
        {
          type: 'paragraph',
          text: 'Interview preparation is much easier when your real experiences are already organised. Do this once and you can answer almost any behavioural question by selecting a story that fits.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'List ten real moments',
              text: 'Things that changed, things you fixed, things you pushed back on, things you built, and one thing you got wrong. Ten is enough for almost any interview.',
            },
            {
              title: 'Tag each against likely competencies',
              text: 'Typical tags: conflict, leadership, failure, ambiguity, prioritisation, influence without authority, customer focus, learning quickly.',
            },
            {
              title: 'Write the Result line first',
              text: 'If you cannot state an outcome honestly, the story is too thin for STAR. Either find a better example or answer the question with something smaller and real.',
            },
            {
              title: 'Rehearse aloud, twice, then stop',
              text: 'Out loud, at a normal speaking pace. Rehearsing in your head is a surprisingly poor substitute.',
            },
          ],
        },
      ],
    },
    {
      id: 'using-ai-to-prepare',
      heading: 'Using AI to prepare, not to fabricate',
      blocks: [
        {
          type: 'paragraph',
          text: 'AI is good at generating likely questions and at pressuring-testing your answers. It must never be the source of the story itself.',
        },
        {
          type: 'callout',
          title: 'Prompts worth running',
          text: '“Here are ten real experiences from my career: [list]. Based only on these, what behavioural questions could I be asked in a [role] interview, and which of my experiences fits each one? Do not invent any experience I have not given you.” Then, once you have an answer: “Ask me three increasingly difficult follow-up questions about this answer, one at a time, and point out anything vague.”',
        },
        {
          type: 'paragraph',
          text: 'That last prompt is the valuable one. Vague answers — “I led the team”, “it went well”, “I improved things” — are what follow-up questions are designed to expose, and an assistant will find them faster and more bluntly than an interviewer will.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'How long should a STAR answer be?',
      answer:
        'Between ninety seconds and three minutes, with the Action section taking roughly half. If you are under a minute, you have probably skipped the result; if you are over four, the situation is too detailed.',
    },
    {
      question: 'What if I cannot think of a good example?',
      answer:
        'Say so honestly and pivot: “I have not handled that exact situation, but the closest was…” Interviewers respect a clear, non-inflated answer far more than an obviously borrowed one.',
    },
    {
      question: 'Should I memorise my answers word for word?',
      answer:
        'No. Memorised answers sound rehearsed and collapse when an interviewer changes the question. Memorise the Result line and roughly the sequence; let the wording be natural each time.',
    },
  ],
  related: [
    {
      label: 'How to prepare for an interview with AI',
      href: '/resources/how-to-prepare-for-an-interview-with-ai',
    },
    { label: 'AI Job Hunter — Complete Edition', href: '/complete' },
    {
      label: 'How to analyze a job description before applying',
      href: '/resources/how-to-analyze-a-job-description-before-applying',
    },
  ],
};
