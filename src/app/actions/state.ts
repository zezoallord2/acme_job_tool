/**
 * Shared server-action state. Kept out of `"use server"` modules because those
 * may only export async functions.
 */
export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const IDLE: ActionState = { ok: true };

export interface AnalysisSubmitResult {
  ok: boolean;
  message?: string;
  errors?: string[];
  repaired?: boolean;
  prompt?: unknown;
}

export const IDLE_ANALYSIS: AnalysisSubmitResult = { ok: true };

/**
 * Result of a coaching workflow submit. Carries the structured output alongside
 * the Manual Mode prompt, because a failed validation must still let the user
 * retry with the same prompt.
 */
export interface CoachingSubmitResult<T = unknown> {
  ok: boolean;
  message?: string;
  errors?: string[];
  repaired?: boolean;
  prompt?: unknown;
  warnings?: string[];
  data?: T;
}

export const IDLE_COACHING: CoachingSubmitResult = { ok: true };
