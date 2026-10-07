import type { AIProviderName } from "@prisma/client";

/**
 * The three AI modes an account can be in.
 *
 * There are exactly three, and the distinction between them is who pays the
 * provider bill. That is the only question a customer actually has, and
 * answering it plainly is worth more than exposing a list of model names.
 *
 * The confusion this replaces: `aiProvider = GEMINI` used to mean both "Acme
 * Jobs pays for Gemini" and "this account has its own Gemini key". Two customers
 * with identical settings were on different billing paths. `ACME_BASIC` makes
 * the Acme-funded choice explicit and selectable on its own.
 */
export type AIMode = "BASIC_AI" | "MANUAL" | "BYOK";

export interface AIModeDefinition {
  id: AIMode;
  label: string;
  /** One line, no hedging. */
  tagline: string;
  /** Who pays the model provider. */
  costOwner: string;
  /** Which plans may select this mode. */
  availableOn: "FREE" | "PAID" | "ANY";
  /** What the user sees if this mode cannot actually run. */
  onUnavailable: "SHOW_MANUAL" | "SHOW_ERROR";
  /** Stored value when this mode is selected but no BYOK provider is chosen yet. */
  storedProvider: AIProviderName;
}

export const AI_MODES: readonly AIModeDefinition[] = [
  {
    id: "BASIC_AI",
    label: "Basic AI",
    tagline: "One click, done for you. Acme Jobs pays the model bill.",
    costOwner: "Included in your plan",
    availableOn: "PAID",
    // A paying customer who cannot get AI has been sold something that does not
    // work. Saying so is honest; silently handing over a copy-paste box is not.
    onUnavailable: "SHOW_ERROR",
    storedProvider: "ACME_BASIC",
  },
  {
    id: "MANUAL",
    label: "Manual Mode",
    tagline:
      "You get a structured brief and paste your own answer back. Free, and it never expires.",
    costOwner: "$0, forever",
    availableOn: "ANY",
    onUnavailable: "SHOW_MANUAL",
    storedProvider: "MANUAL",
  },
  {
    id: "BYOK",
    label: "Bring Your Own Key",
    tagline:
      "Use your own provider key for the best models and highest limits. You are billed by them.",
    costOwner: "Billed to your provider account",
    // BYOK costs Acme Jobs nothing, so allowing it on the free plan is pure upside:
    // more people get working AI without a single dollar of expense.
    availableOn: "ANY",
    onUnavailable: "SHOW_ERROR",
    storedProvider: "GEMINI",
  },
] as const;

export function modeDefinition(id: AIMode): AIModeDefinition {
  const found = AI_MODES.find((m) => m.id === id);
  if (!found) throw new Error(`Unknown AI mode: ${id}`);
  return found;
}

/**
 * Works out the mode from what is stored on the account.
 *
 * `storedProvider` carries the choice; whether it is BYOK depends on a key
 * actually existing, because a customer may pick "Bring Your Own Key" before
 * adding the key.
 */
export function resolveMode(input: {
  storedProvider: AIProviderName | null | undefined;
  hasOwnKey: boolean;
  isComplete: boolean;
}): AIMode {
  const stored = input.storedProvider ?? "MANUAL";

  if (stored === "MANUAL" || stored === "LOCAL") return "MANUAL";
  if (stored === "ACME_BASIC") return "BASIC_AI";

  // A named provider means BYOK once a key exists. Without one, an account that
  // is entitled to Basic AI falls back to it rather than being stranded.
  if (input.hasOwnKey) return "BYOK";
  return input.isComplete ? "BASIC_AI" : "MANUAL";
}

/** Modes an account is allowed to pick, given its plan. */
export function availableModes(isComplete: boolean): AIModeDefinition[] {
  return AI_MODES.filter((m) => {
    if (m.availableOn === "ANY") return true;
    return m.availableOn === "PAID" ? isComplete : !isComplete;
  });
}
