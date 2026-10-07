import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

/**
 * Acme Jobs lint configuration.
 *
 * This deliberately does not use `eslint-config-next`. That package pulls
 * `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`, and the
 * advisory on `braces` (GHSA-vfj7-8cjw-p6xm) has no patched release: 3.0.3 is
 * both the newest version and inside the vulnerable range. Dropping the package
 * removed 183 transitive dependencies and took `npm audit` to zero.
 *
 * The rules below deliberately re-implement the Next.js presets that matter here:
 * the React Hooks rules, the JSX accessibility rules, and TypeScript-aware
 * parsing. See docs/SECURITY.md.
 */
const ignores = [
  "node_modules/**",
  ".next/**",
  "dist/**",
  "out/**",
  "data/**",
  "backups/**",
  "coverage/**",
  "test-results/**",
  "playwright-report/**",
  "blob-report/**",
  "prisma/migrations/**",
  "next-env.d.ts",
  // Unrelated projects that happen to live in this directory are not part of
  // Acme Jobs and must not affect its lint, build or audit.
  "acme webite/**",
  "acme-webite-whop/**",
  "my website/**",
];

const config = [
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      // TypeScript
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      // Prefer the TS-aware rule so `catch (e: unknown)` stays honest.
      "no-undef": "off",
      "no-unused-vars": "off",

      // House rules
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // Server actions legitimately log, and CLI scripts must print their output.
    files: ["scripts/**/*.ts", "prisma/**/*.ts", "e2e/**/*.ts", "tests/**"],
    rules: { "no-console": "off" },
  },
  {
    // Test and end-to-end files legitimately set non-null assertions and use
    // loose doubles.
    files: ["tests/**", "e2e/**"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    // Every `page.tsx` in this app is a React Server Component: it renders once
    // per request and is never re-rendered in place, so `Date.now()` is stable
    // for the life of the response. The purity rule exists to catch unstable
    // client renders, which this is not.
    files: ["src/app/**/page.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
];

export default config;
