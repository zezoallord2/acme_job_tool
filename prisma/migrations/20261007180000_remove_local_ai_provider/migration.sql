-- Retire the LOCAL AI provider.
--
-- The local (Ollama / llama.cpp) provider was removed from the codebase. It
-- defaulted to http://127.0.0.1:11434, which does not exist on a hosted server,
-- so new accounts silently fell through to Manual Mode and looked broken.
-- Inference is now served by hosted providers with real free tiers.
--
-- PostgreSQL cannot DROP a value from an enum, so the value is renamed to a
-- sentinel instead. Renaming keeps existing rows valid while making the option
-- unreachable: no application code can reference the new name, and it cannot
-- collide with any future provider.

-- Any account still pointing at the local endpoint moves to Manual Mode, which
-- is the honest equivalent: the endpoint it referred to no longer exists.
UPDATE "UserSettings" SET "aiProvider" = 'MANUAL' WHERE "aiProvider" = 'LOCAL';

ALTER TYPE "AIProviderName" RENAME VALUE 'LOCAL' TO 'RETIRED_LOCAL';