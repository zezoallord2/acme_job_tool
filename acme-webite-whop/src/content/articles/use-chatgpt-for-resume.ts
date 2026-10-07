import type { Article } from './types';

export const useChatGptForResume: Article = {
  slug: 'how-to-use-chatgpt-for-your-resume-without-sounding-generic',
  title: 'How to Use ChatGPT for Your Resume Without Sounding Generic',
  description:
    'Why AI resume drafts sound generic, and the specific prompting and editing habits that make AI-assisted bullets sound like an actual person.',
  intent: 'AI resume prompts',
  section: 'Resumes',
  published: '2026-01-28',
  updated: '2026-02-20',
  readingMinutes: 7,
  summary:
    'Generic AI writing is usually the result of generic input. Fix the input, restrict the model, and edit like a human — and the same assistant produces specific, defensible lines.',
  sections: [
    {
      id: 'why-it-sounds-generic',
      heading: 'Why AI resume writing sounds generic',
      blocks: [
        {
          type: 'paragraph',
          text: 'There are three causes, and none of them are “the AI is bad”.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'You gave it a job description instead of your experience. The model fills the shape of the role with plausible language.',
            'You asked for “better” rather than for a specific transformation. “Better” has no constraints, so you get the statistical average of resume writing.',
            'You accepted the first draft. First drafts from a language model are deliberately safe, which is exactly what makes them forgettable.',
          ],
        },
        {
          type: 'paragraph',
          text: 'A useful test: if the sentence would be equally true for the three other people who applied, it is not doing any work. Delete it or make it specific.',
        },
      ],
    },
    {
      id: 'give-it-real-input',
      heading: 'Give it real input, not a job description',
      blocks: [
        {
          type: 'paragraph',
          text: 'Start every session with your own material. Write out, in plain prose, what you actually did in a role: what you owned, what was hard, what changed as a result. Do not tidy it. The messier the input, the more specific the output.',
        },
        {
          type: 'callout',
          title: 'Prompt that works',
          text: 'Here is what I did in my last role, in plain text: [paste]. The role I am applying for needs: [paste two or three requirements]. Rewrite my sentences so each one addresses a requirement. Use only facts I have given you. If a fact is missing, write [NEEDS INPUT] instead of inventing one. Keep my voice — short sentences, no adjectives I would not use.',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Always request [NEEDS INPUT]',
          text: 'This single instruction is the most effective guardrail available. It converts the model from inventing content into requesting the missing detail from you — which is a task it is genuinely good at.',
        },
      ],
    },
    {
      id: 'constrain-the-style',
      heading: 'Constrain the style so it cannot drift',
      blocks: [
        {
          type: 'paragraph',
          text: 'Left alone, models reach for corporate rhythm: “leveraged”, “spearheaded”, “dynamic”, “results-driven”, and a fondness for three-part lists. Name the failure modes explicitly, because they are predictable.',
        },
        {
          type: 'list',
          items: [
            'Ban words you would not say out loud in an interview.',
            'Require one concrete noun or number per sentence.',
            'Ask for three options at 12, 20 and 30 words so you can compare.',
            'Request one version that starts with the verb.',
            'Ask for a version with no adjectives at all.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Comparing lengths is the fastest way to hear how much padding a sentence is carrying. Most weak bullets collapse by about a third when you ask for a 12-word version, and the removed words are almost always filler.',
        },
      ],
    },
    {
      id: 'edit-like-a-human',
      heading: 'Edit like a human, then verify',
      blocks: [
        {
          type: 'paragraph',
          text: 'Treat the output as a first draft from a capable but uninvolved writer. That means two passes: one for voice, one for truth.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Voice pass',
              text: 'Read each bullet aloud. If you would not say it in an interview, rewrite it in your own words — even if that means discarding the AI’s structure.',
            },
            {
              title: 'Claim pass',
              text: 'Check every number, tool, certification and responsibility against your actual history. Anything unverified comes out. This is the step that keeps the whole approach honest.',
            },
            {
              title: 'Consistency pass',
              text: 'Make sure the same experience is described the same way everywhere — resume, cover letter, LinkedIn. Contradictions between documents are the thing interviewers notice.',
            },
          ],
        },
        {
          type: 'callout',
          tone: 'note',
          title: 'Where this fits in the method',
          text: 'AI is best at comparison, restructuring and drafting. It is worst at knowing what is true about you. The Acme Jobs workflow keeps the truth in a document you control, and uses AI only for the parts where being wrong is cheap.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'Will AI make my resume better automatically?',
      answer:
        'It will make it more fluent. Fluency is not the goal — clarity and specificity are. Used without a system, AI writing tends to remove exactly the details that made your experience credible.',
    },
    {
      question: 'Is it wrong to use AI to write my resume?',
      answer:
        'No, as long as everything in the document is true and you can defend it. The responsibility for accuracy stays with you, regardless of who or what drafted the sentence.',
    },
    {
      question: 'Should I use one long chat or a fresh one for each section?',
      answer:
        'Use a fresh chat per task where possible. A long conversation accumulates the model’s earlier assumptions, and those assumptions quietly become “facts” about your career in later drafts.',
    },
  ],
  related: [
    {
      label: 'How to tailor a resume with AI without lying',
      href: '/resources/how-to-tailor-a-resume-with-ai-without-lying',
    },
    { label: 'Fresh graduate resume guide', href: '/resources/fresh-graduate-resume-guide' },
    { label: 'AI Job Search Starter Guide (free)', href: '/free' },
  ],
};
