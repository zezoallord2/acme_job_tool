import type { Article } from './types';

export const prepareInterviewWithAi: Article = {
  slug: 'how-to-prepare-for-an-interview-with-ai',
  title: 'How to Prepare for an Interview With AI',
  description:
    'Use AI to build realistic interview questions, stress-test your answers and research the company — without letting it write a performance you cannot deliver.',
  intent: 'AI interview preparation',
  section: 'Interviews',
  published: '2026-02-23',
  updated: '2026-03-05',
  readingMinutes: 8,
  summary:
    'AI is genuinely useful for rehearsal: it will generate more questions than you would think of, follow up harder than a friendly interviewer, and tell you where an answer is vague. It is not useful for pretending.',
  sections: [
    {
      id: 'what-ai-is-good-for',
      heading: 'What AI is genuinely good for',
      blocks: [
        {
          type: 'list',
          items: [
            'Generating the questions you were not expecting, especially for the second half of a long interview.',
            'Asking follow-ups until your answer stops being vague.',
            'Turning a job description into a technical or competency question list.',
            'Preparing you to talk about your weaknesses and gaps without sounding defensive.',
            'Rehearsing your salary or notice-period answers.',
          ],
        },
        {
          type: 'paragraph',
          text: 'All of these are rehearsal tasks. None of them require the assistant to know anything true about you that you have not told it — which is exactly why they are safe to use well.',
        },
      ],
    },
    {
      id: 'the-rehearsal-loop',
      heading: 'The rehearsal loop that works',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Supply the real material',
              text: 'Paste the job description, the role’s top three requirements, and your actual experience in plain text. Everything the assistant asks you will be grounded in that.',
            },
            {
              title: 'Ask for questions in rounds',
              text: 'Start with: “Give me the eight questions I am most likely to be asked, hardest last.” Then ask for four more you would not expect.',
            },
            {
              title: 'Answer out loud, then get attacked',
              text: 'Type or speak your answer, then ask: “Ask me a harder follow-up about this. If any part is vague, unsupported or sounds generic, tell me exactly which part and why.”',
            },
            {
              title: 'Repair and repeat',
              text: 'Fix only the specific weak point, then answer the question again from scratch. Three cycles is usually enough.',
            },
          ],
        },
        {
          type: 'callout',
          title: 'A prompt worth saving',
          text: '“You are an experienced interviewer for [role]. Ask me one question at a time. After each answer, ask one follow-up that digs deeper. After four questions, summarise my three weakest answers and tell me what evidence I am missing. Only use the job description and experience I have given you.”',
        },
      ],
    },
    {
      id: 'company-research',
      heading: 'Use AI for company research, then verify',
      blocks: [
        {
          type: 'paragraph',
          text: 'Research is where AI saves the most time, and where it is most likely to confabulate. Models will happily invent funding rounds, product names and customer counts.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Use AI to generate the questions you should be asking, not to answer them.',
            'Read the company’s own site, recent announcements and job postings directly.',
            'Check any specific claim — headcount, funding, product — against a primary source before you repeat it in an interview.',
            'Prepare two real questions about the team or the role, based on what you actually read.',
          ],
        },
      ],
    },
    {
      id: 'the-line-not-to-cross',
      heading: 'The line not to cross',
      blocks: [
        {
          type: 'paragraph',
          text: 'The temptation is to have AI write you a polished “personal story” that sounds impressive in the abstract. Do not. Interviewers probe for specifics, and a beautiful surface with nothing underneath ends the interview in about ten minutes.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'What to never accept from an assistant',
          text: 'Any metric, employer, tool, certification, or responsibility that you have not personally lived. If it comes out of your mouth, you own it. The assistant cannot be in the room to explain it later.',
        },
      ],
    },
    {
      id: 'the-night-before',
      heading: 'The night before',
      blocks: [
        {
          type: 'list',
          items: [
            'Re-read your three strongest STAR stories until you can tell each in ninety seconds.',
            'Check who you are meeting and what their role is.',
            'Prepare two questions to ask them. Always two, even if you run out of time.',
            'Re-read your application so your answers match it.',
            'Stop rehearsing at least an hour before. Sleep is worth more than one more practice answer.',
          ],
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Is it acceptable to use AI to prepare for an interview?',
      answer:
        'Yes. Preparation tools, question generators and mock interviews are normal. What matters is that every claim you make in the room is true and that you understand your own answers rather than having them written for you.',
    },
    {
      question: 'Can AI tell me what questions a specific company will ask?',
      answer:
        'It can tell you what questions are likely for that kind of role and company size. It cannot know the actual questions, and any assistant claiming otherwise is guessing. Use it to prepare broadly, not narrowly.',
    },
    {
      question: 'Should I practise with a voice tool?',
      answer:
        'Out loud matters more than the tool. Speaking your answers surfaces filler words and rambling that silent reading hides, and it is the only way to build the pace you will need in the room.',
    },
  ],
  related: [
    {
      label: 'STAR interview method: practical examples',
      href: '/resources/star-interview-method-practical-examples',
    },
    {
      label: 'How to analyze a job description before applying',
      href: '/resources/how-to-analyze-a-job-description-before-applying',
    },
    { label: 'AI Job Hunter — Complete Edition', href: '/complete' },
  ],
};
