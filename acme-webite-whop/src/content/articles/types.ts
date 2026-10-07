export type ArticleBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; id: string; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'callout'; tone?: 'note' | 'warn'; title: string; text: string }
  | { type: 'example'; title: string; before: string; after: string }
  | { type: 'steps'; items: { title: string; text: string }[] };

export interface ArticleSection {
  id: string;
  heading: string;
  blocks: ArticleBlock[];
}

export interface ArticleFaq {
  question: string;
  answer: string;
}

export interface Article {
  slug: string;
  title: string;
  /** Meta description, 140–165 characters. */
  description: string;
  /** Primary search intent, e.g. 'resume tailoring with AI'. */
  intent: string;
  section: 'Resumes' | 'Job search' | 'Interviews' | 'Career change';
  published: string;
  updated: string;
  readingMinutes: number;
  /** One-sentence answer shown at the top of the article. */
  summary: string;
  sections: ArticleSection[];
  faq: ArticleFaq[];
  /** Internal links placed after the article body. */
  related: { label: string; href: string }[];
}
