import type { Article } from './types';
import { tailorResumeWithAi } from './tailor-resume-with-ai';
import { analyzeJobDescription } from './analyze-job-description';
import { useChatGptForResume } from './use-chatgpt-for-resume';
import { starInterviewMethod } from './star-interview-method';
import { freshGraduateResume } from './fresh-graduate-resume';
import { careerChangeResume } from './career-change-resume';
import { prepareInterviewWithAi } from './prepare-interview-with-ai';
import { decideWorthApplying } from './decide-worth-applying';

export const articles: Article[] = [
  tailorResumeWithAi,
  analyzeJobDescription,
  useChatGptForResume,
  starInterviewMethod,
  freshGraduateResume,
  careerChangeResume,
  prepareInterviewWithAi,
  decideWorthApplying,
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

export function getArticleSlugs(): string[] {
  return articles.map((article) => article.slug);
}

/** Newest first. */
export function getSortedArticles(): Article[] {
  return [...articles].sort((a, b) => (a.updated < b.updated ? 1 : -1));
}

export type { Article, ArticleBlock, ArticleFaq, ArticleSection } from './types';
