import type { Article } from './types';

export const freshGraduateResume: Article = {
  slug: 'fresh-graduate-resume-guide',
  title: 'Fresh Graduate Resume Guide: Turning What You Have Into Evidence',
  description:
    'How to write a graduate resume when you have little paid experience — mapping coursework, projects, part-time work and volunteering into defensible evidence.',
  intent: 'fresh graduate resume',
  section: 'Resumes',
  published: '2026-02-09',
  updated: '2026-02-25',
  readingMinutes: 8,
  summary:
    'The problem is rarely that you have “no experience”. It is that your experience is described as activities rather than as evidence. That is a translation problem, and it is solvable.',
  sections: [
    {
      id: 'the-real-problem',
      heading: 'The real problem is translation, not emptiness',
      blocks: [
        {
          type: 'paragraph',
          text: 'Most graduate resumes describe categories: “Relevant coursework”, “Part-time work”, “Volunteering”. Recruiters are scanning for evidence of things they will have to train you to do. Categories do not provide evidence; specific contributions do.',
        },
        {
          type: 'paragraph',
          text: 'You almost certainly have more usable material than you think: group projects where you did the work nobody else wanted, a part-time shift where you handled something outside your duties, a society role where you ran an event, a dissertation constraint that forced a decision.',
        },
        {
          type: 'callout',
          tone: 'note',
          title: 'A workable definition of evidence',
          text: 'Something you were responsible for, with a defined beginning and end, that produced an observable change — however small. You did the work, something came out of it.',
        },
      ],
    },
    {
      id: 'mine-what-you-have',
      heading: 'Mine what you already have',
      blocks: [
        {
          type: 'list',
          items: [
            'Group coursework — which module did you lead, and what did you produce?',
            'Individual projects — what constraint did you work under, and what did you trade off?',
            'Part-time and retail work — did you handle returns, train anyone, order stock, deal with a complaint?',
            'Volunteering and societies — did you organise, budget, recruit, or handle a difficult person?',
            'Care responsibilities — coordination, scheduling, problem-solving under time pressure. Say it plainly.',
            'Personal projects — anything you built, ran, coached, or maintained.',
          ],
        },
        {
          type: 'paragraph',
          text: 'Write each one as a single sentence in the STAR Result form before you turn it into a bullet. If the Result sentence is empty, dig further — the outcome is usually hiding in a detail you considered obvious.',
        },
      ],
    },
    {
      id: 'structure',
      heading: 'A structure that works for one page',
      blocks: [
        {
          type: 'paragraph',
          text: 'For most graduate applications, one page is enough and two is a liability. The constraint forces you to choose, and choosing is a signal of judgement.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Header',
              text: 'Name, location, email, phone, and a link if relevant. No date of birth, nationality or marital status — they are not asked for and modern UK/EU/US screening does not want them.',
            },
            {
              title: 'One-line positioning',
              text: 'What you are aiming for plus the two or three things you can genuinely support. Not a personality statement.',
            },
            {
              title: 'Experience and projects',
              text: 'Take the majority of the page. Order by relevance to the role, not by date, and put your strongest evidence first.',
            },
            {
              title: 'Skills — split into two lists',
              text: 'Tools and methods you can actually use, and everything else you have exposure to. Keep the split honest; it is very easy to see through.',
            },
            {
              title: 'Education last, briefly',
              text: 'Degree, institution, dates, grade if strong. Two or three relevant modules at most.',
            },
          ],
        },
      ],
    },
    {
      id: 'avoid-inflation',
      heading: 'Avoid the two classic graduate mistakes',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Inflating part-time work into a job title you did not hold. “Shift supervisor” when you were “team member who covered the tills” is the kind of thing that ends an interview.',
            'Listing every module you have ever taken. Choose the ones that support the role, and be ready to discuss any of them — because you will be asked.',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'The graduate ATS reality',
          text: 'Some large employers use keyword screening. This is not a reason to invent experience. It is a reason to use the employer’s own terminology for the real skills you have — which is exactly what evidence-based tailoring is for.',
        },
      ],
    },
  ],
  faq: [
    {
      question: 'How long should a graduate resume be?',
      answer:
        'One page, almost always. If you have significant relevant paid work or a portfolio, two pages is acceptable. The limit is useful: it forces you to select your strongest evidence.',
    },
    {
      question: 'Should I include my grades if they are not strong?',
      answer:
        'Usually not, unless you are applying somewhere that asks. If they are strong, include them clearly. Leaving them out is normal and not a red flag at graduate level.',
    },
    {
      question: 'What if I genuinely have nothing relevant?',
      answer:
        'Then restructure around what you do have and target roles where it is relevant — including operations, customer-facing, admin and support roles, where graduate schemes often live. AI cannot manufacture evidence, but it can help you find evidence you were dismissing.',
    },
  ],
  related: [
    {
      label: 'How to use ChatGPT for your resume without sounding generic',
      href: '/resources/how-to-use-chatgpt-for-your-resume-without-sounding-generic',
    },
    { label: 'Career change resume guide', href: '/resources/career-change-resume-guide' },
    { label: 'AI Job Search Starter Guide (free)', href: '/free' },
  ],
};
