import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id password hashing (RFC 9106). Parameters are explicit so the cost can
 * be raised on hardware that supports it, and stored per-hash so old hashes keep
 * verifying after a parameter change.
 */
const PARAMS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, {
    memoryCost: PARAMS.memoryCost,
    timeCost: PARAMS.timeCost,
    parallelism: PARAMS.parallelism,
    outputLen: PARAMS.outputLen,
  });
}

export async function verifyPassword(
  storedHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext);
  } catch {
    // A malformed stored hash must fail closed, never throw into the request path.
    return false;
  }
}

export interface PasswordPolicyResult {
  ok: boolean;
  problems: string[];
}

/**
 * Deliberately modest requirements. Over-strict password policy pushes people
 * toward reuse; length plus a blocklist is stronger and friendlier.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "letmein123",
  "welcome123",
  "iloveyou1",
  "admin123",
  "jobsearch1",
  "career123",
]);

export function checkPasswordPolicy(
  password: string,
  minLength: number,
  context: { email?: string | null; name?: string | null } = {},
): PasswordPolicyResult {
  const problems: string[] = [];
  if (password.length < minLength)
    problems.push(`Use at least ${minLength} characters.`);
  if (password.length > 200) problems.push("Use fewer than 200 characters.");
  if (/\s$/.test(password)) problems.push("Remove trailing whitespace.");
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower))
    problems.push(
      "That password is too common. Choose something less guessable.",
    );
  for (const part of COMMON_PASSWORDS) {
    if (lower.includes(part) && lower.length < minLength + 4) {
      problems.push(
        "That password is too common. Choose something less guessable.",
      );
      break;
    }
  }
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    problems.push("Do not include your email address in your password.");
  }
  if (
    context.name &&
    context.name.length >= 4 &&
    lower.includes(context.name.toLowerCase())
  ) {
    problems.push("Do not include your name in your password.");
  }
  return { ok: problems.length === 0, problems };
}
