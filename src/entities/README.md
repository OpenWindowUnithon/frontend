# entities

Business/domain concepts and their canonical shape + CRUD primitives
(`call`, `caption`, `user`). **No user-interaction or orchestration logic**
here — no forms, no "on submit", no toasts. That's what `features` is for.
An entity answers "what is a Caption and how do I publish/subscribe to one,"
never "what happens when the user clicks add."

## Segments

- `model/` — the zod schema + inferred TS type. The schema is the single
  source of truth for the shape; don't hand-write a duplicate `interface`
  next to it.
- `api/` — requests through `shared/api`'s `apiClient` (or `shared/lib`'s
  transport helpers, e.g. `call/api/call-api.ts`'s LiveKit token fetch) plus
  any TanStack Query hooks and query-key factory a REST-backed entity needs —
  always centralize keys there, never inline a query key at the call site.
- `ui/` — small presentational components that render **one instance** of
  the entity (a card/row, like `caption/ui/caption.tsx`). No mutations, no
  forms — purely "given a Caption, render it."

## Import rules

`entities` → may only import from `shared`.
`entities` → may **not** import from another `entities` slice, or from
`features`/`widgets`/`pages`/`app`. If entity A needs entity B's data,
that composition happens one layer up (in a `feature` or `widget`), never
inside the entity itself.

Enforced by `steiger` (`fsd/no-cross-imports`, `fsd/no-higher-level-imports`)
— violations fail `bun run arch:lint` and block the commit.

## Mocking before the backend exists

For a REST-backed entity, add a `VITE_USE_MOCK` flag to `shared/config/env.ts`
(enum + transform, not `z.coerce.boolean()` — see the existing zod schema for
why) and serve an in-memory mock instead of a real request when it's set —
useful before the backend is ready, or as a demo-day fallback if it goes
down. Keep the mock in its own `mock.ts` next to the real calls, gate each
function on the flag, and return data shaped exactly like the real response.

## Naming

Singular noun, kebab-case if multi-word: `call`, `user-profile`.

## Scaffolding

```bash
bun run new:slice -- --layer=entities --name=user
```
